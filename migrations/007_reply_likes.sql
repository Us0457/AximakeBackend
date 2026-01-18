-- 007_reply_likes.sql
-- Add likes column to support_forum_replies to support per-reply likes.
BEGIN;

ALTER TABLE IF EXISTS public.support_forum_replies
  ADD COLUMN IF NOT EXISTS likes integer DEFAULT 0 NOT NULL;

COMMIT;
