-- Task 2: server-only quota reservation and persistent internal-request replay protection.
-- No credit or billing mutation. Deploy separately; application calls fail closed until applied.
CREATE OR REPLACE FUNCTION public.intentlead_consume_chat_quota(
  p_workspace_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace public.workspaces%ROWTYPE;
  v_now timestamptz;
  v_midnight timestamptz;
  v_used integer;
  v_limit integer;
BEGIN
  -- Caller is service_role; the authenticated subject is supplied by the server,
  -- then checked against the locked row. No independent caller-provided plan/limit.
  SELECT * INTO v_workspace FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Compute time after acquiring the lock, including requests that waited across midnight.
  v_now := clock_timestamp();
  v_midnight := date_trunc('day', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_used := CASE WHEN v_workspace.chat_messages_reset_at IS NULL
      OR v_workspace.chat_messages_reset_at < v_midnight
    THEN 0 ELSE v_workspace.chat_messages_today END;
  v_limit := CASE v_workspace.plan
    WHEN 'agency' THEN NULL
    WHEN 'starter' THEN 100 WHEN 'starter_ltd' THEN 100
    WHEN 'growth' THEN 300 WHEN 'growth_ltd' THEN 300
    ELSE 20 END;
  IF v_limit IS NOT NULL AND v_used >= v_limit THEN RETURN false; END IF;

  UPDATE public.workspaces
    SET chat_messages_today = least(v_used::bigint + 1, 2147483647)::integer,
        chat_messages_reset_at = v_now
    WHERE id = p_workspace_id AND owner_id = p_user_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_consume_chat_quota(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_consume_chat_quota(uuid, uuid) TO service_role;

CREATE TABLE public.intentlead_worker_nonces (
  nonce uuid PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
ALTER TABLE public.intentlead_worker_nonces ENABLE ROW LEVEL SECURITY;
-- No policies: even service_role uses the narrowly granted definer RPC, not direct access.
REVOKE ALL ON TABLE public.intentlead_worker_nonces FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX intentlead_worker_nonces_expiry_idx ON public.intentlead_worker_nonces (expires_at);

CREATE OR REPLACE FUNCTION public.intentlead_claim_worker_nonce(
  p_nonce uuid,
  p_timestamp bigint
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_seconds bigint := floor(extract(epoch FROM v_now))::bigint;
  v_inserted integer;
BEGIN
  IF p_nonce IS NULL OR p_timestamp IS NULL
    OR p_timestamp < v_seconds - 60 OR p_timestamp > v_seconds + 60
  THEN RETURN false; END IF;

  DELETE FROM public.intentlead_worker_nonces WHERE expires_at <= v_now;
  INSERT INTO public.intentlead_worker_nonces (nonce, expires_at)
    -- Retain until the final acceptable second has elapsed, including future clock skew.
    VALUES (p_nonce, to_timestamp(p_timestamp + 61))
    ON CONFLICT (nonce) DO NOTHING;
  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_claim_worker_nonce(uuid, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_claim_worker_nonce(uuid, bigint) TO service_role;
