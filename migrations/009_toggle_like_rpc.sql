-- 009_toggle_like_rpc.sql
-- Toggle like RPC: atomically insert/delete a like for a user and return the new liked state and likes count.
BEGIN;

-- Ensure unique constraint exists
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_forum_likes_unique ON public.support_forum_likes (user_id, item_type, item_id);

CREATE OR REPLACE FUNCTION public.toggle_like(uid uuid, itype text, iid uuid)
RETURNS TABLE(is_liked boolean, likes_count integer) LANGUAGE plpgsql AS $$
DECLARE
  deleted_count integer := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'toggle_like: user id required';
  END IF;

  -- attempt delete (unlike)
  DELETE FROM public.support_forum_likes WHERE user_id = uid AND item_type = itype AND item_id = iid;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  IF deleted_count > 0 THEN
    -- deleted: now return new likes count from the parent table
    IF itype = 'question' THEN
      SELECT COALESCE(likes,0) INTO likes_count FROM public.support_forum_questions WHERE id = iid;
    ELSE
      SELECT COALESCE(likes,0) INTO likes_count FROM public.support_forum_replies WHERE id = iid;
    END IF;
    is_liked := false;
    RETURN NEXT;
    RETURN;
  END IF;

  -- not deleted: insert like (idempotent due to unique index)
  INSERT INTO public.support_forum_likes (user_id, item_type, item_id)
  VALUES (uid, itype, iid)
  ON CONFLICT (user_id, item_type, item_id) DO NOTHING;

  -- return updated likes count from parent
  IF itype = 'question' THEN
    SELECT COALESCE(likes,0) INTO likes_count FROM public.support_forum_questions WHERE id = iid;
  ELSE
    SELECT COALESCE(likes,0) INTO likes_count FROM public.support_forum_replies WHERE id = iid;
  END IF;
  is_liked := true;
  RETURN NEXT;
END; $$;

COMMIT;
