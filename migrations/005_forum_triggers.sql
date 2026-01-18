-- 005_forum_triggers.sql
-- Populate existing metadata and add triggers/functions to maintain counts and accepted-answer state.
BEGIN;

-- Populate replies_count from existing replies
UPDATE public.support_forum_questions q
SET replies_count = COALESCE(sub.cnt, 0)
FROM (
  SELECT question_id, COUNT(*) as cnt FROM public.support_forum_replies GROUP BY question_id
) sub
WHERE sub.question_id = q.id;

-- Populate accepted_reply_id from replies marked is_accepted
UPDATE public.support_forum_questions q
SET accepted_reply_id = sub.id,
    accepted_at = sub.created_at,
    accepted_by = sub.author_id,
    status = 'Answered'
FROM (
  SELECT id, question_id, created_at, author_id FROM public.support_forum_replies WHERE is_accepted = true
) sub
WHERE sub.question_id = q.id;

-- Ensure views are non-null
UPDATE public.support_forum_questions SET views = COALESCE(views, 0);

-- Function: increment replies_count on insert
CREATE OR REPLACE FUNCTION public.forum_inc_replies_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_forum_questions
  SET replies_count = COALESCE(replies_count,0) + 1
  WHERE id = NEW.question_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.forum_dec_replies_count()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_forum_questions
  SET replies_count = GREATEST(COALESCE(replies_count,0) - 1, 0)
  WHERE id = OLD.question_id;
  RETURN OLD;
END; $$;

-- Attach triggers for insert/delete on replies
DROP TRIGGER IF EXISTS trg_inc_replies ON public.support_forum_replies;
CREATE TRIGGER trg_inc_replies AFTER INSERT ON public.support_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.forum_inc_replies_count();

DROP TRIGGER IF EXISTS trg_dec_replies ON public.support_forum_replies;
CREATE TRIGGER trg_dec_replies AFTER DELETE ON public.support_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.forum_dec_replies_count();

-- Function to handle accepted answer state on insert/update
CREATE OR REPLACE FUNCTION public.forum_handle_accepted()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- On insert or update, if a reply is marked accepted, update the question
  IF (TG_OP = 'INSERT') THEN
    IF (NEW.is_accepted = true) THEN
      UPDATE public.support_forum_questions
      SET accepted_reply_id = NEW.id, accepted_at = NEW.created_at, accepted_by = NEW.author_id, status = 'Answered'
      WHERE id = NEW.question_id;
    END IF;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- If marking accepted
    IF (NEW.is_accepted = true AND (OLD.is_accepted IS DISTINCT FROM NEW.is_accepted)) THEN
      UPDATE public.support_forum_questions
      SET accepted_reply_id = NEW.id, accepted_at = NEW.created_at, accepted_by = NEW.author_id, status = 'Answered'
      WHERE id = NEW.question_id;
    ELSIF (OLD.is_accepted = true AND NEW.is_accepted = false) THEN
      -- If unmarking accepted, clear question accepted fields only if it references this reply
      UPDATE public.support_forum_questions
      SET accepted_reply_id = NULL, accepted_at = NULL, accepted_by = NULL
      WHERE id = NEW.question_id AND accepted_reply_id = OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_accepted ON public.support_forum_replies;
CREATE TRIGGER trg_accepted AFTER INSERT OR UPDATE OF is_accepted ON public.support_forum_replies
FOR EACH ROW EXECUTE FUNCTION public.forum_handle_accepted();

-- RPC: atomic increment for views
CREATE OR REPLACE FUNCTION public.increment_question_views(qid uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.support_forum_questions
  SET views = COALESCE(views,0) + 1
  WHERE id = qid;
END; $$;

COMMIT;
