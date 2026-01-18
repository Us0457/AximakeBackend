-- 006_forum_likes.sql
-- Add RPC functions to atomically increment likes for questions and replies.
BEGIN;

CREATE OR REPLACE FUNCTION public.increment_question_likes(qid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_forum_questions
  SET likes = COALESCE(likes,0) + 1
  WHERE id = qid;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_reply_likes(rid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_forum_replies
  SET likes = COALESCE(likes,0) + 1
  WHERE id = rid;
END; $$;

COMMIT;
