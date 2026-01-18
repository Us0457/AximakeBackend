-- 008_support_forum_user_likes.sql
-- Create a per-user likes table to prevent duplicate likes and keep counts consistent via triggers.
BEGIN;

-- ensure likes columns exist on parent tables
ALTER TABLE IF EXISTS public.support_forum_questions
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0 NOT NULL;

ALTER TABLE IF EXISTS public.support_forum_replies
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0 NOT NULL;

-- create likes table
CREATE TABLE IF NOT EXISTS public.support_forum_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('question','reply')),
  item_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- function to increment counts
CREATE OR REPLACE FUNCTION public.forum_handle_like_insert()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.item_type = 'question') THEN
    UPDATE public.support_forum_questions SET likes = COALESCE(likes,0) + 1 WHERE id = NEW.item_id;
  ELSIF (NEW.item_type = 'reply') THEN
    UPDATE public.support_forum_replies SET likes = COALESCE(likes,0) + 1 WHERE id = NEW.item_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.forum_handle_like_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.item_type = 'question') THEN
    UPDATE public.support_forum_questions SET likes = GREATEST(COALESCE(likes,0) - 1, 0) WHERE id = OLD.item_id;
  ELSIF (OLD.item_type = 'reply') THEN
    UPDATE public.support_forum_replies SET likes = GREATEST(COALESCE(likes,0) - 1, 0) WHERE id = OLD.item_id;
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_like_insert ON public.support_forum_likes;
CREATE TRIGGER trg_like_insert AFTER INSERT ON public.support_forum_likes
FOR EACH ROW EXECUTE FUNCTION public.forum_handle_like_insert();

DROP TRIGGER IF EXISTS trg_like_delete ON public.support_forum_likes;
CREATE TRIGGER trg_like_delete AFTER DELETE ON public.support_forum_likes
FOR EACH ROW EXECUTE FUNCTION public.forum_handle_like_delete();

COMMIT;
