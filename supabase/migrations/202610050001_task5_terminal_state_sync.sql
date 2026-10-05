-- Task 5 follow-up: keep terminal durable-job, DiscoveryBrief and legacy campaign
-- state in one transaction, serialized with owner-authorized deletion.

CREATE OR REPLACE FUNCTION public.intentlead_sync_job_terminal_state(
  p_workspace_id uuid,
  p_discovery_brief_id uuid,
  p_terminal_state text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief_state text;
  v_campaign_state text;
BEGIN
  IF p_terminal_state IN ('COMPLETED', 'PARTIAL') THEN
    v_brief_state := 'COMPLETED';
    v_campaign_state := 'done';
  ELSIF p_terminal_state = 'FAILED' THEN
    v_brief_state := 'FAILED';
    v_campaign_state := 'error';
  ELSIF p_terminal_state = 'CANCELLED' THEN
    v_brief_state := 'CANCELLED';
    v_campaign_state := 'error';
  ELSE
    RAISE EXCEPTION 'invalid_terminal_state';
  END IF;

  UPDATE public.intentlead_discovery_briefs
  SET state = v_brief_state, updated_at = clock_timestamp()
  WHERE id = p_discovery_brief_id AND workspace_id = p_workspace_id
    AND (state IN ('DRAFT', 'QUEUED', 'RUNNING') OR state = v_brief_state);

  UPDATE public.campaigns c
  SET status = v_campaign_state, updated_at = clock_timestamp()
  FROM public.intentlead_discovery_briefs b
  WHERE b.id = p_discovery_brief_id AND b.workspace_id = p_workspace_id
    AND c.id = b.legacy_campaign_id AND c.workspace_id = p_workspace_id
    AND (c.status IN ('draft', 'running') OR c.status = v_campaign_state);
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_sync_job_terminal_state(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_sync_job_terminal_state(uuid, uuid, text)
  TO service_role;

CREATE OR REPLACE FUNCTION public.intentlead_lease_next_job(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
) RETURNS SETOF public.intentlead_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_candidate record;
  v_terminal public.intentlead_jobs%ROWTYPE;
  v_job_id uuid;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = ''
    OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 3600
  THEN RAISE EXCEPTION 'invalid_lease_input'; END IF;

  -- Deletion takes the same workspace advisory lock before touching jobs. This
  -- prevents a stale lease from resurrecting a brief/campaign after tombstoning.
  FOR v_candidate IN
    SELECT id, workspace_id
    FROM public.intentlead_jobs
    WHERE state IN ('LEASED', 'RUNNING') AND lease_expires_at <= clock_timestamp()
      AND attempt >= max_attempts
    ORDER BY workspace_id, id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_candidate.workspace_id::text, 0));
    UPDATE public.intentlead_jobs SET state = 'FAILED',
      error = jsonb_build_object(
        'schemaVersion', 1, 'code', 'INTERNAL_ERROR',
        'message', 'Lease expired after retry budget exhausted',
        'capability', capability, 'traceId', trace_id,
        'retryable', false, 'retryAfterMs', NULL
      ),
      completed_at = clock_timestamp(), completion_token = lease_token,
      completion_worker = lease_owner,
      completion_fingerprint = md5(lease_owner || E'\n' || lease_token::text || E'\nFAILED\nnull\n' ||
        jsonb_build_object(
          'schemaVersion', 1, 'code', 'INTERNAL_ERROR',
          'message', 'Lease expired after retry budget exhausted',
          'capability', capability, 'traceId', trace_id,
          'retryable', false, 'retryAfterMs', NULL
        )::text),
      lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = v_candidate.id AND state IN ('LEASED', 'RUNNING')
      AND lease_expires_at <= clock_timestamp() AND attempt >= max_attempts
    RETURNING * INTO v_terminal;
    IF FOUND AND v_terminal.discovery_brief_id IS NOT NULL THEN
      PERFORM public.intentlead_sync_job_terminal_state(
        v_terminal.workspace_id, v_terminal.discovery_brief_id, 'FAILED'
      );
    END IF;
  END LOOP;

  SELECT id INTO v_job_id FROM public.intentlead_jobs
  WHERE attempt < max_attempts AND cancellation_requested_at IS NULL
    AND ((state = 'QUEUED' AND available_at <= clock_timestamp())
      OR (state = 'RETRY_WAIT' AND available_at <= clock_timestamp())
      OR (state IN ('LEASED', 'RUNNING') AND lease_expires_at <= clock_timestamp()))
  ORDER BY available_at, created_at, id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF v_job_id IS NULL THEN RETURN; END IF;
  RETURN QUERY UPDATE public.intentlead_jobs SET state = 'LEASED', attempt = attempt + 1,
    lease_owner = p_worker_id, lease_token = gen_random_uuid(),
    lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
    heartbeat_at = NULL, started_at = coalesce(started_at, clock_timestamp()),
    completion_token = NULL, completion_worker = NULL, completion_fingerprint = NULL
    WHERE id = v_job_id RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_complete_job(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_terminal_state text,
  p_result jsonb, p_error jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_workspace_id uuid;
  v_fingerprint text;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' OR p_lease_token IS NULL
    OR p_terminal_state NOT IN ('COMPLETED', 'PARTIAL', 'FAILED')
    OR (p_result IS NOT NULL AND jsonb_typeof(p_result) <> 'object')
    OR (p_error IS NOT NULL AND jsonb_typeof(p_error) <> 'object')
    OR (p_terminal_state = 'COMPLETED' AND (p_result IS NULL OR p_error IS NOT NULL))
    OR (p_terminal_state = 'PARTIAL' AND (p_result IS NULL OR p_error IS NULL))
    OR (p_terminal_state = 'FAILED' AND p_error IS NULL)
  THEN RETURN false; END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM public.intentlead_jobs WHERE id = p_job_id;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_workspace_id::text, 0));

  v_fingerprint := md5(p_worker_id || E'\n' || p_lease_token::text || E'\n' || p_terminal_state || E'\n'
    || coalesce(p_result::text, 'null') || E'\n' || coalesce(p_error::text, 'null'));
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.state IN ('COMPLETED', 'PARTIAL', 'FAILED') THEN
    RETURN v_job.completion_token = p_lease_token AND v_job.completion_worker = p_worker_id
      AND v_job.completion_fingerprint = v_fingerprint;
  END IF;
  IF v_job.state NOT IN ('LEASED', 'RUNNING') OR v_job.lease_owner <> p_worker_id
    OR v_job.lease_token <> p_lease_token OR v_job.lease_expires_at <= clock_timestamp()
  THEN RETURN false; END IF;

  UPDATE public.intentlead_jobs SET state = p_terminal_state, result = p_result, error = p_error,
    completed_at = clock_timestamp(), completion_token = p_lease_token, completion_worker = p_worker_id,
    completion_fingerprint = v_fingerprint, lease_owner = NULL, lease_token = NULL,
    lease_expires_at = NULL, heartbeat_at = NULL
  WHERE id = p_job_id;
  IF v_job.discovery_brief_id IS NOT NULL THEN
    PERFORM public.intentlead_sync_job_terminal_state(
      v_job.workspace_id, v_job.discovery_brief_id, p_terminal_state
    );
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_cancel_job(
  p_job_id uuid,
  p_user_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_job public.intentlead_jobs%ROWTYPE;
BEGIN
  SELECT j.workspace_id INTO v_workspace_id
  FROM public.intentlead_jobs j
  JOIN public.workspaces w ON w.id = j.workspace_id
  WHERE j.id = p_job_id AND w.owner_id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_workspace_id::text, 0));
  SELECT j.* INTO v_job
  FROM public.intentlead_jobs j
  JOIN public.workspaces w ON w.id = j.workspace_id
  WHERE j.id = p_job_id AND w.owner_id = p_user_id
  FOR UPDATE OF j, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_job.state IN ('COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED') THEN RETURN false; END IF;

  UPDATE public.intentlead_jobs
  SET state = 'CANCELLED', cancellation_requested_at = clock_timestamp(),
      cancelled_at = clock_timestamp(), lease_owner = NULL, lease_token = NULL,
      lease_expires_at = NULL, heartbeat_at = NULL
  WHERE id = p_job_id;
  IF v_job.discovery_brief_id IS NOT NULL THEN
    PERFORM public.intentlead_sync_job_terminal_state(
      v_job.workspace_id, v_job.discovery_brief_id, 'CANCELLED'
    );
  END IF;
  RETURN true;
END;
$$;

-- Repair terminal rows created before this follow-up, without overriding an
-- already terminal/deleted brief or a terminal legacy campaign state.
UPDATE public.intentlead_discovery_briefs b
SET state = CASE WHEN j.state IN ('COMPLETED', 'PARTIAL') THEN 'COMPLETED'
                 WHEN j.state = 'FAILED' THEN 'FAILED'
                 ELSE 'CANCELLED' END,
    updated_at = clock_timestamp()
FROM public.intentlead_jobs j
WHERE j.discovery_brief_id = b.id AND j.workspace_id = b.workspace_id
  AND j.state IN ('COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')
  AND b.state IN ('DRAFT', 'QUEUED', 'RUNNING');

UPDATE public.campaigns c
SET status = CASE WHEN j.state IN ('COMPLETED', 'PARTIAL') THEN 'done' ELSE 'error' END,
    updated_at = clock_timestamp()
FROM public.intentlead_discovery_briefs b
JOIN public.intentlead_jobs j ON j.discovery_brief_id = b.id AND j.workspace_id = b.workspace_id
WHERE c.id = b.legacy_campaign_id AND c.workspace_id = b.workspace_id
  AND j.state IN ('COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')
  AND c.status IN ('draft', 'running');

DO $$
BEGIN
  IF to_regprocedure('public.intentlead_delete_discovery_brief_task5_v1(uuid,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
      RENAME TO intentlead_delete_discovery_brief_task5_v1;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief_task5_v1(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_delete_discovery_brief(
  p_discovery_brief_id uuid,
  p_user_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_campaign_id uuid;
BEGIN
  -- The original owner-authorized erasure runs first and retains the workspace
  -- advisory lock through this wrapper's final relational cleanup.
  IF NOT public.intentlead_delete_discovery_brief_task5_v1(
    p_discovery_brief_id, p_user_id, p_reason
  ) THEN RETURN false; END IF;

  SELECT workspace_id, legacy_campaign_id
  INTO v_workspace_id, v_campaign_id
  FROM public.intentlead_discovery_briefs
  WHERE id = p_discovery_brief_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.intentlead_buyer_candidates b
  SET role_title = '[deleted]', hypothesis = '[deleted]',
      tombstoned_at = coalesce(b.tombstoned_at, clock_timestamp())
  FROM public.intentlead_opportunities o
  WHERE o.id = b.opportunity_id AND o.workspace_id = v_workspace_id
    AND o.discovery_brief_id = p_discovery_brief_id;

  IF v_campaign_id IS NOT NULL THEN
    -- FK-safe, owner-scoped legacy graph removal; the campaign row remains only
    -- as a mapping/audit tombstone with nonessential business data removed.
    DELETE FROM public.messages m
    USING public.leads l
    WHERE m.lead_id = l.id AND l.campaign_id = v_campaign_id;
    DELETE FROM public.leads WHERE campaign_id = v_campaign_id;
    DELETE FROM public.signals WHERE campaign_id = v_campaign_id;

    UPDATE public.campaigns
    SET status = 'error', what_selling = '[deleted]', icp = '[deleted]', pain = '[deleted]',
        geo = NULL, example_customers = NULL, keywords = '{}'::text[], tone = NULL,
        glook_scan_id = NULL, updated_at = clock_timestamp()
    WHERE id = v_campaign_id AND workspace_id = v_workspace_id;
  END IF;
  RETURN true;
END;
$$;

DO $$
DECLARE
  v_signature regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.intentlead_lease_next_job(text,integer)'::regprocedure,
    'public.intentlead_complete_job(uuid,text,uuid,text,jsonb,jsonb)'::regprocedure,
    'public.intentlead_cancel_job(uuid,uuid)'::regprocedure,
    'public.intentlead_delete_discovery_brief(uuid,uuid,text)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END
$$;
