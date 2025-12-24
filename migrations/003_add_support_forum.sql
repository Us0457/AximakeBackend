-- Migration: Add Support Forum tables, triggers, indexes, and RLS policies
-- Run this in the Supabase SQL editor (use the Project SQL editor or run with the Service Role key).

-- 1) Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) Questions table
CREATE TABLE IF NOT EXISTS public.support_forum_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  status text NOT NULL DEFAULT 'Open',
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text,
  replies_count integer NOT NULL DEFAULT 0,
  accepted_reply_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_forum_questions
  ADD CONSTRAINT support_forum_questions_status_check CHECK (status IN ('Open','Answered','Closed'));

-- 3) Replies table
CREATE TABLE IF NOT EXISTS public.support_forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.support_forum_questions(id) ON DELETE CASCADE,
  content text NOT NULL,
  author_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name text,
  is_official boolean DEFAULT false,
  is_accepted boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- add FK from questions.accepted_reply_id -> replies.id (deferred since replies table now exists)
ALTER TABLE public.support_forum_questions
  ADD CONSTRAINT support_forum_questions_accepted_fk FOREIGN KEY (accepted_reply_id) REFERENCES public.support_forum_replies(id) ON DELETE SET NULL;

-- 4) Indexes & full-text search support
CREATE INDEX IF NOT EXISTS idx_support_forum_questions_created_at ON public.support_forum_questions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_forum_replies_question_created ON public.support_forum_replies (question_id, created_at DESC);
-- GIN index for simple full-text search on title+description
CREATE INDEX IF NOT EXISTS idx_support_forum_questions_fts ON public.support_forum_questions USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- 5) Triggers: automatic updated_at maintenance
CREATE OR REPLACE FUNCTION public.set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_timestamp_questions
BEFORE UPDATE ON public.support_forum_questions
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

CREATE TRIGGER trg_set_timestamp_replies
BEFORE UPDATE ON public.support_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.set_timestamp();

-- 6) Maintain replies_count on questions
CREATE OR REPLACE FUNCTION public.maintain_replies_count()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.support_forum_questions SET replies_count = replies_count + 1 WHERE id = NEW.question_id;
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.support_forum_questions SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = OLD.question_id;
    RETURN OLD;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.question_id IS DISTINCT FROM NEW.question_id) THEN
      -- moved to another question: decrement old, increment new
      UPDATE public.support_forum_questions SET replies_count = GREATEST(replies_count - 1, 0) WHERE id = OLD.question_id;
      UPDATE public.support_forum_questions SET replies_count = replies_count + 1 WHERE id = NEW.question_id;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_replies_count_ins AFTER INSERT ON public.support_forum_replies FOR EACH ROW EXECUTE FUNCTION public.maintain_replies_count();
CREATE TRIGGER trg_replies_count_del AFTER DELETE ON public.support_forum_replies FOR EACH ROW EXECUTE FUNCTION public.maintain_replies_count();
CREATE TRIGGER trg_replies_count_upd AFTER UPDATE ON public.support_forum_replies FOR EACH ROW WHEN (OLD.question_id IS DISTINCT FROM NEW.question_id) EXECUTE FUNCTION public.maintain_replies_count();

-- 7) Keep accepted_reply_id and question status in sync when replies are accepted/unaccepted
CREATE OR REPLACE FUNCTION public.sync_accepted_reply()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    -- If a reply is newly accepted
    IF (NEW.is_accepted IS TRUE AND (OLD.is_accepted IS DISTINCT FROM NEW.is_accepted)) THEN
      UPDATE public.support_forum_questions SET accepted_reply_id = NEW.id, status = 'Answered' WHERE id = NEW.question_id;
    ELSIF (OLD.is_accepted IS TRUE AND NEW.is_accepted IS FALSE) THEN
      -- accepted was removed
      UPDATE public.support_forum_questions SET accepted_reply_id = NULL WHERE id = NEW.question_id AND accepted_reply_id = OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_accepted AFTER UPDATE OF is_accepted ON public.support_forum_replies FOR EACH ROW EXECUTE FUNCTION public.sync_accepted_reply();

-- 8) Row-Level Security (RLS) policies
-- NOTE: Review and adjust these policies to fit your auth/profile setup. These are conservative and practical defaults.

-- Enable RLS
ALTER TABLE public.support_forum_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_forum_replies ENABLE ROW LEVEL SECURITY;

-- Helper: admin check (uses public.profiles.role = 'admin')
-- Policy: allow anyone to read questions and replies
CREATE POLICY "public_select_questions" ON public.support_forum_questions FOR SELECT USING (true);
CREATE POLICY "public_select_replies" ON public.support_forum_replies FOR SELECT USING (true);

-- Allow inserts: either an authenticated user that sets their own author_id, or a guest (author_id IS NULL)
CREATE POLICY "insert_questions_allow_self_or_guest" ON public.support_forum_questions FOR INSERT
  WITH CHECK ( (author_id IS NULL) OR (auth.uid() = author_id) );

CREATE POLICY "insert_replies_allow_self_or_guest" ON public.support_forum_replies FOR INSERT
  WITH CHECK ( (author_id IS NULL) OR (auth.uid() = author_id) );

-- Allow updates/deletes by the author or by admins
-- Allow updates by the author or by admins (separate UPDATE and DELETE policies)
CREATE POLICY "update_questions_owner_or_admin" ON public.support_forum_questions FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "delete_questions_owner_or_admin" ON public.support_forum_questions FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "update_replies_owner_or_admin" ON public.support_forum_replies FOR UPDATE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

CREATE POLICY "delete_replies_owner_or_admin" ON public.support_forum_replies FOR DELETE
  USING (
    (auth.uid() IS NOT NULL AND auth.uid() = author_id)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Admin-only: allow admins to update status/accepted_reply_id/is_official fields
CREATE POLICY "admin_modify_moderation_fields_questions" ON public.support_forum_questions FOR UPDATE
  USING ( EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') );

CREATE POLICY "admin_modify_moderation_fields_replies" ON public.support_forum_replies FOR UPDATE
  USING ( EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') )
  WITH CHECK ( EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin') );

-- 9) Useful example grants (optional)
-- Grant select/insert/update/delete to authenticated role if you prefer role-based grants
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_forum_questions TO authenticated;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_forum_replies TO authenticated;

-- 10) Example: backfill replies_count (in case you already have replies)
-- UPDATE public.support_forum_questions q SET replies_count = COALESCE(r.cnt,0) FROM (SELECT question_id, COUNT(*)::int AS cnt FROM public.support_forum_replies GROUP BY question_id) r WHERE q.id = r.question_id;

-- End of migration
