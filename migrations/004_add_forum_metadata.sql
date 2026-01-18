-- 004_add_forum_metadata.sql
-- Add common forum metadata columns so the frontend can read/write them
BEGIN;

ALTER TABLE IF EXISTS public.support_forum_questions
  ADD COLUMN IF NOT EXISTS views integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS replies_count integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS comments integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS accepted_reply_id uuid NULL,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS accepted_by uuid NULL;

-- Optional: indexes to speed up common queries
CREATE INDEX IF NOT EXISTS idx_support_forum_questions_category ON public.support_forum_questions (category);
CREATE INDEX IF NOT EXISTS idx_support_forum_questions_created_at ON public.support_forum_questions (created_at DESC);

COMMIT;
