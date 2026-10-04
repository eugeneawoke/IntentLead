-- Task 4: Postgres-backed durable jobs. All mutation paths validate ownership or lease identity.

CREATE TABLE public.intentlead_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  discovery_brief_id uuid,
  market_profile_key text NOT NULL CHECK (market_profile_key IN ('EN_DISCOVERY_ONLY','CIS_RU','LOCAL_CUSTOM')),
  capability text NOT NULL CHECK (capability IN (
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW',
    'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
    'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
  )),
  job_type text NOT NULL CHECK (job_type = 'OPPORTUNITY_DISCOVERY'),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  state text NOT NULL DEFAULT 'QUEUED'
    CHECK (state IN ('QUEUED', 'LEASED', 'RUNNING', 'RETRY_WAIT', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED')),
  attempt integer NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  max_attempts integer NOT NULL DEFAULT 3 CHECK (max_attempts > 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_owner text,
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  started_at timestamptz,
  cancellation_requested_at timestamptz,
  cancelled_at timestamptz,
  completed_at timestamptz,
  completion_token uuid,
  result jsonb CHECK (result IS NULL OR jsonb_typeof(result) = 'object'),
  error jsonb CHECK (error IS NULL OR jsonb_typeof(error) = 'object'),
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checkpoint) = 'object'),
  cost_scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cost_scope) = 'object'),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  trace_id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, discovery_brief_id)
    REFERENCES public.intentlead_discovery_briefs(workspace_id, id),
  CHECK (attempt <= max_attempts),
  CHECK (
    (state IN ('LEASED', 'RUNNING') AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_expires_at IS NOT NULL)
    OR (state NOT IN ('LEASED', 'RUNNING') AND lease_owner IS NULL AND lease_token IS NULL AND lease_expires_at IS NULL)
  ),
  CHECK (state <> 'RETRY_WAIT' OR attempt < max_attempts),
  CHECK ((state IN ('COMPLETED', 'PARTIAL', 'FAILED')) = (completed_at IS NOT NULL)),
  CHECK ((state = 'CANCELLED') = (cancelled_at IS NOT NULL))
);

CREATE TABLE public.intentlead_job_step_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  job_id uuid NOT NULL,
  step_key text NOT NULL CHECK (btrim(step_key) <> ''),
  attempt integer NOT NULL CHECK (attempt > 0),
  state text NOT NULL CHECK (state IN ('STARTED', 'COMPLETED', 'RETRYABLE_FAILED', 'PERMANENT_FAILED', 'CANCELLED')),
  provider_run_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  timeout_ms integer CHECK (timeout_ms IS NULL OR timeout_ms > 0),
  retry_reason text,
  checkpoint jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checkpoint) = 'object'),
  cost_scope jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cost_scope) = 'object'),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (job_id, step_key, attempt),
  FOREIGN KEY (workspace_id, job_id)
    REFERENCES public.intentlead_jobs(workspace_id, id) ON DELETE CASCADE,
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

ALTER TABLE public.intentlead_provider_runs
  ADD CONSTRAINT intentlead_provider_run_job_fk
  FOREIGN KEY (workspace_id, job_id)
  REFERENCES public.intentlead_jobs(workspace_id, id);

CREATE INDEX intentlead_jobs_lease_candidate_idx
  ON public.intentlead_jobs(state, available_at, lease_expires_at, created_at)
  WHERE state IN ('QUEUED', 'LEASED', 'RUNNING', 'RETRY_WAIT');
CREATE INDEX intentlead_jobs_workspace_state_idx
  ON public.intentlead_jobs(workspace_id, state, updated_at DESC);
CREATE INDEX intentlead_job_step_attempts_job_idx
  ON public.intentlead_job_step_attempts(job_id, step_key, attempt DESC);

ALTER TABLE public.intentlead_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intentlead_job_step_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY intentlead_workspace_read ON public.intentlead_jobs
  FOR SELECT TO authenticated
  USING (public.intentlead_is_workspace_member(workspace_id));
CREATE POLICY intentlead_workspace_read ON public.intentlead_job_step_attempts
  FOR SELECT TO authenticated
  USING (public.intentlead_is_workspace_member(workspace_id));

REVOKE ALL ON TABLE public.intentlead_jobs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.intentlead_job_step_attempts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.intentlead_jobs, public.intentlead_job_step_attempts TO authenticated, service_role;

CREATE TRIGGER intentlead_touch_updated_at
  BEFORE UPDATE ON public.intentlead_jobs
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_touch_updated_at();

CREATE OR REPLACE FUNCTION public.intentlead_enqueue_discovery_job(
  p_discovery_brief_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_job_id uuid;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
  THEN RAISE EXCEPTION 'invalid_enqueue_input'; END IF;

  SELECT b.* INTO v_brief
  FROM public.intentlead_discovery_briefs b
  JOIN public.workspaces w ON w.id = b.workspace_id
  WHERE b.id = p_discovery_brief_id AND w.owner_id = p_user_id
  FOR UPDATE OF b, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT id INTO v_job_id FROM public.intentlead_jobs
    WHERE workspace_id = v_brief.workspace_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.intentlead_jobs
      WHERE id = v_job_id AND discovery_brief_id = p_discovery_brief_id
    ) THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_job_id;
  END IF;

  IF v_brief.state <> 'DRAFT' THEN RAISE EXCEPTION 'brief_transition_denied'; END IF;
  IF v_brief.legacy_campaign_id IS NOT NULL THEN
    UPDATE public.campaigns
      SET status = 'running', updated_at = clock_timestamp()
      WHERE id = v_brief.legacy_campaign_id
        AND workspace_id = v_brief.workspace_id
        AND status = 'draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'campaign_transition_denied'; END IF;
  END IF;

  INSERT INTO public.intentlead_jobs
    (workspace_id, discovery_brief_id, capability, job_type, payload, idempotency_key)
  VALUES (
    v_brief.workspace_id, v_brief.id, 'SOURCE_SEARCH', 'OPPORTUNITY_DISCOVERY',
    p_payload, p_idempotency_key
  )
  RETURNING id INTO v_job_id;
  UPDATE public.intentlead_discovery_briefs
    SET state = 'QUEUED' WHERE id = v_brief.id;
  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_lease_next_job(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
) RETURNS SETOF public.intentlead_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = ''
    OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 3600
  THEN RAISE EXCEPTION 'invalid_lease_input'; END IF;

  SELECT id INTO v_job_id
  FROM public.intentlead_jobs
  WHERE attempt < max_attempts
    AND cancellation_requested_at IS NULL
    AND (
      (state = 'QUEUED' AND available_at <= clock_timestamp())
      OR (state = 'RETRY_WAIT' AND available_at <= clock_timestamp())
      OR (state IN ('LEASED', 'RUNNING') AND lease_expires_at <= clock_timestamp())
    )
  ORDER BY available_at, created_at, id
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_job_id IS NULL THEN RETURN; END IF;
  RETURN QUERY
  UPDATE public.intentlead_jobs
    SET state = 'LEASED', attempt = attempt + 1,
        lease_owner = p_worker_id, lease_token = gen_random_uuid(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds),
        heartbeat_at = NULL, started_at = coalesce(started_at, clock_timestamp()),
        completion_token = NULL
    WHERE id = v_job_id
    RETURNING *;
END;
$$;

-- Final hardened definitions override the bootstrap-compatible versions above.
CREATE OR REPLACE FUNCTION public.intentlead_record_job_step_attempt(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_step_key text,
  p_step_attempt integer, p_state text, p_provider_run_ids uuid[] DEFAULT '{}'::uuid[],
  p_timeout_ms integer DEFAULT NULL, p_retry_reason text DEFAULT NULL,
  p_checkpoint jsonb DEFAULT '{}'::jsonb, p_cost_scope jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_job_attempt integer;
  v_existing public.intentlead_job_step_attempts%ROWTYPE;
  v_step_id uuid;
BEGIN
  IF p_step_key IS NULL OR btrim(p_step_key) = '' OR p_step_attempt IS NULL OR p_step_attempt <= 0
    OR p_state NOT IN ('STARTED','COMPLETED','RETRYABLE_FAILED','PERMANENT_FAILED','CANCELLED')
    OR p_provider_run_ids IS NULL OR (p_timeout_ms IS NOT NULL AND p_timeout_ms <= 0)
    OR p_checkpoint IS NULL OR jsonb_typeof(p_checkpoint) <> 'object'
    OR p_cost_scope IS NULL OR jsonb_typeof(p_cost_scope) <> 'object'
  THEN RAISE EXCEPTION 'invalid_step_attempt'; END IF;
  SELECT workspace_id, attempt INTO v_workspace_id, v_job_attempt FROM public.intentlead_jobs
    WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
      AND state IN ('LEASED','RUNNING') AND lease_expires_at > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_step_attempt <> v_job_attempt THEN RAISE EXCEPTION 'step_job_attempt_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_provider_run_ids) run_id
    WHERE NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs pr
      WHERE pr.id = run_id AND pr.workspace_id = v_workspace_id)
  ) THEN RAISE EXCEPTION 'step_provider_run_mismatch'; END IF;
  SELECT * INTO v_existing FROM public.intentlead_job_step_attempts
    WHERE job_id = p_job_id AND step_key = p_step_key AND attempt = p_step_attempt FOR UPDATE;
  IF FOUND THEN
    IF v_existing.state <> 'STARTED' AND v_existing.state <> p_state THEN RAISE EXCEPTION 'step_attempt_conflict'; END IF;
    UPDATE public.intentlead_job_step_attempts SET state = p_state,
      timeout_ms = p_timeout_ms, retry_reason = p_retry_reason,
      checkpoint = p_checkpoint, cost_scope = p_cost_scope,
      finished_at = CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END
      WHERE id = v_existing.id RETURNING id INTO v_step_id;
  ELSE
    INSERT INTO public.intentlead_job_step_attempts
      (workspace_id, job_id, step_key, attempt, state, timeout_ms, retry_reason, checkpoint, cost_scope, finished_at)
    VALUES (v_workspace_id, p_job_id, p_step_key, p_step_attempt, p_state, p_timeout_ms,
      p_retry_reason, p_checkpoint, p_cost_scope,
      CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END)
    RETURNING id INTO v_step_id;
  END IF;
  INSERT INTO public.intentlead_job_step_provider_runs(workspace_id, step_attempt_id, provider_run_id)
    SELECT v_workspace_id, v_step_id, run_id FROM unnest(p_provider_run_ids) run_id ON CONFLICT DO NOTHING;
  RETURN v_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_complete_job(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_terminal_state text,
  p_result jsonb, p_error jsonb
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_fingerprint text;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' OR p_lease_token IS NULL
    OR p_terminal_state NOT IN ('COMPLETED','PARTIAL','FAILED')
    OR (p_result IS NOT NULL AND jsonb_typeof(p_result) <> 'object')
    OR (p_error IS NOT NULL AND jsonb_typeof(p_error) <> 'object')
    OR (p_terminal_state = 'COMPLETED' AND (p_result IS NULL OR p_error IS NOT NULL))
    OR (p_terminal_state = 'PARTIAL' AND (p_result IS NULL OR p_error IS NULL))
    OR (p_terminal_state = 'FAILED' AND p_error IS NULL)
  THEN RETURN false; END IF;
  v_fingerprint := md5(p_worker_id || E'\n' || p_lease_token::text || E'\n' || p_terminal_state || E'\n'
    || coalesce(p_result::text, 'null') || E'\n' || coalesce(p_error::text, 'null'));
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.state IN ('COMPLETED','PARTIAL','FAILED') THEN
    RETURN v_job.completion_token = p_lease_token AND v_job.completion_worker = p_worker_id
      AND v_job.completion_fingerprint = v_fingerprint;
  END IF;
  IF v_job.state NOT IN ('LEASED','RUNNING') OR v_job.lease_owner <> p_worker_id
    OR v_job.lease_token <> p_lease_token OR v_job.lease_expires_at <= clock_timestamp()
  THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs SET state = p_terminal_state, result = p_result, error = p_error,
    completed_at = clock_timestamp(), completion_token = p_lease_token,
    completion_worker = p_worker_id, completion_fingerprint = v_fingerprint,
    lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_record_job_step_attempt(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_step_key text,
  p_step_attempt integer,
  p_state text,
  p_provider_run_ids uuid[] DEFAULT '{}'::uuid[],
  p_timeout_ms integer DEFAULT NULL,
  p_retry_reason text DEFAULT NULL,
  p_checkpoint jsonb DEFAULT '{}'::jsonb,
  p_cost_scope jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_job_attempt integer;
  v_existing public.intentlead_job_step_attempts%ROWTYPE;
  v_step_id uuid;
BEGIN
  IF p_step_key IS NULL OR btrim(p_step_key) = '' OR p_step_attempt IS NULL OR p_step_attempt <= 0
    OR p_state NOT IN ('STARTED','COMPLETED','RETRYABLE_FAILED','PERMANENT_FAILED','CANCELLED')
    OR p_provider_run_ids IS NULL OR (p_timeout_ms IS NOT NULL AND p_timeout_ms <= 0)
    OR p_checkpoint IS NULL OR jsonb_typeof(p_checkpoint) <> 'object'
    OR p_cost_scope IS NULL OR jsonb_typeof(p_cost_scope) <> 'object'
  THEN RAISE EXCEPTION 'invalid_step_attempt'; END IF;

  SELECT workspace_id, attempt INTO v_workspace_id, v_job_attempt
  FROM public.intentlead_jobs
  WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
    AND state IN ('LEASED','RUNNING') AND lease_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_step_attempt <> v_job_attempt THEN RAISE EXCEPTION 'step_job_attempt_mismatch'; END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(p_provider_run_ids) run_id
    WHERE NOT EXISTS (
      SELECT 1 FROM public.intentlead_provider_runs pr
      WHERE pr.id = run_id AND pr.workspace_id = v_workspace_id
    )
  ) THEN RAISE EXCEPTION 'step_provider_run_mismatch'; END IF;

  SELECT * INTO v_existing FROM public.intentlead_job_step_attempts
    WHERE job_id = p_job_id AND step_key = p_step_key AND attempt = p_step_attempt FOR UPDATE;
  IF FOUND THEN
    IF v_existing.state <> 'STARTED' AND v_existing.state <> p_state THEN RAISE EXCEPTION 'step_attempt_conflict'; END IF;
    UPDATE public.intentlead_job_step_attempts SET state = p_state,
      timeout_ms = p_timeout_ms, retry_reason = p_retry_reason,
      checkpoint = p_checkpoint, cost_scope = p_cost_scope,
      finished_at = CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END
      WHERE id = v_existing.id RETURNING id INTO v_step_id;
  ELSE
    INSERT INTO public.intentlead_job_step_attempts
      (workspace_id, job_id, step_key, attempt, state, timeout_ms, retry_reason,
       checkpoint, cost_scope, finished_at)
    VALUES (v_workspace_id, p_job_id, p_step_key, p_step_attempt, p_state,
      p_timeout_ms, p_retry_reason, p_checkpoint, p_cost_scope,
      CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END)
    RETURNING id INTO v_step_id;
  END IF;
  INSERT INTO public.intentlead_job_step_provider_runs(workspace_id, step_attempt_id, provider_run_id)
    SELECT v_workspace_id, v_step_id, run_id FROM unnest(p_provider_run_ids) run_id
    ON CONFLICT DO NOTHING;
  RETURN v_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_terminal_state text,
  p_result jsonb,
  p_error jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_fingerprint text;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = '' OR p_lease_token IS NULL
    OR p_terminal_state NOT IN ('COMPLETED','PARTIAL','FAILED')
    OR (p_result IS NOT NULL AND jsonb_typeof(p_result) <> 'object')
    OR (p_error IS NOT NULL AND jsonb_typeof(p_error) <> 'object')
    OR (p_terminal_state = 'COMPLETED' AND (p_result IS NULL OR p_error IS NOT NULL))
    OR (p_terminal_state = 'PARTIAL' AND (p_result IS NULL OR p_error IS NULL))
    OR (p_terminal_state = 'FAILED' AND p_error IS NULL)
  THEN RETURN false; END IF;
  v_fingerprint := md5(p_worker_id || E'\n' || p_lease_token::text || E'\n' || p_terminal_state || E'\n'
    || coalesce(p_result::text, 'null') || E'\n' || coalesce(p_error::text, 'null'));

  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.state IN ('COMPLETED','PARTIAL','FAILED') THEN
    RETURN v_job.completion_token = p_lease_token
      AND v_job.completion_worker = p_worker_id
      AND v_job.completion_fingerprint = v_fingerprint;
  END IF;
  IF v_job.state NOT IN ('LEASED','RUNNING') OR v_job.lease_owner <> p_worker_id
    OR v_job.lease_token <> p_lease_token OR v_job.lease_expires_at <= clock_timestamp()
  THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs SET state = p_terminal_state, result = p_result, error = p_error,
    completed_at = clock_timestamp(), completion_token = p_lease_token,
    completion_worker = p_worker_id, completion_fingerprint = v_fingerprint,
    lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = p_job_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_heartbeat_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_lease_seconds integer DEFAULT 60
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 3600 THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs
    SET state = 'RUNNING', heartbeat_at = clock_timestamp(),
        lease_expires_at = clock_timestamp() + make_interval(secs => p_lease_seconds)
    WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
      AND state IN ('LEASED', 'RUNNING') AND lease_expires_at > clock_timestamp();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_checkpoint_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_checkpoint jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_checkpoint IS NULL OR jsonb_typeof(p_checkpoint) <> 'object' THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs
    SET checkpoint = p_checkpoint, heartbeat_at = clock_timestamp()
    WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
      AND state IN ('LEASED', 'RUNNING') AND lease_expires_at > clock_timestamp();
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_record_job_step_attempt(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_step_key text,
  p_step_attempt integer,
  p_state text,
  p_provider_run_ids uuid[] DEFAULT '{}'::uuid[],
  p_timeout_ms integer DEFAULT NULL,
  p_retry_reason text DEFAULT NULL,
  p_checkpoint jsonb DEFAULT '{}'::jsonb,
  p_cost_scope jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_existing public.intentlead_job_step_attempts%ROWTYPE;
  v_step_id uuid;
BEGIN
  IF p_step_key IS NULL OR btrim(p_step_key) = '' OR p_step_attempt IS NULL OR p_step_attempt <= 0
    OR p_state NOT IN ('STARTED', 'COMPLETED', 'RETRYABLE_FAILED', 'PERMANENT_FAILED', 'CANCELLED')
    OR p_provider_run_ids IS NULL
    OR (p_timeout_ms IS NOT NULL AND p_timeout_ms <= 0)
    OR p_checkpoint IS NULL OR jsonb_typeof(p_checkpoint) <> 'object'
    OR p_cost_scope IS NULL OR jsonb_typeof(p_cost_scope) <> 'object'
  THEN RAISE EXCEPTION 'invalid_step_attempt'; END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM public.intentlead_jobs
  WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
    AND state IN ('LEASED', 'RUNNING') AND lease_expires_at > clock_timestamp()
  FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO v_existing FROM public.intentlead_job_step_attempts
    WHERE job_id = p_job_id AND step_key = p_step_key AND attempt = p_step_attempt
    FOR UPDATE;
  IF FOUND THEN
    IF v_existing.state <> 'STARTED' AND v_existing.state <> p_state THEN
      RAISE EXCEPTION 'step_attempt_conflict';
    END IF;
    UPDATE public.intentlead_job_step_attempts
      SET state = p_state, provider_run_ids = p_provider_run_ids,
          timeout_ms = p_timeout_ms, retry_reason = p_retry_reason,
          checkpoint = p_checkpoint, cost_scope = p_cost_scope,
          finished_at = CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END
      WHERE id = v_existing.id
      RETURNING id INTO v_step_id;
    RETURN v_step_id;
  END IF;

  INSERT INTO public.intentlead_job_step_attempts
    (workspace_id, job_id, step_key, attempt, state, provider_run_ids, timeout_ms,
     retry_reason, checkpoint, cost_scope, finished_at)
  VALUES (
    v_workspace_id, p_job_id, p_step_key, p_step_attempt, p_state, p_provider_run_ids,
    p_timeout_ms, p_retry_reason, p_checkpoint, p_cost_scope,
    CASE WHEN p_state = 'STARTED' THEN NULL ELSE clock_timestamp() END
  ) RETURNING id INTO v_step_id;
  RETURN v_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_retry_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_error jsonb,
  p_available_at timestamptz
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_error IS NULL OR jsonb_typeof(p_error) <> 'object'
    OR p_available_at IS NULL OR p_available_at <= clock_timestamp()
  THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs
    SET state = 'RETRY_WAIT', error = p_error, available_at = p_available_at,
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
      AND state IN ('LEASED', 'RUNNING') AND lease_expires_at > clock_timestamp()
      AND attempt < max_attempts;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_complete_job(
  p_job_id uuid,
  p_worker_id text,
  p_lease_token uuid,
  p_terminal_state text,
  p_result jsonb,
  p_error jsonb
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
BEGIN
  IF p_terminal_state NOT IN ('COMPLETED', 'PARTIAL', 'FAILED')
    OR (p_result IS NOT NULL AND jsonb_typeof(p_result) <> 'object')
    OR (p_error IS NOT NULL AND jsonb_typeof(p_error) <> 'object')
    OR (p_terminal_state = 'COMPLETED' AND p_error IS NOT NULL)
    OR (p_terminal_state = 'FAILED' AND p_error IS NULL)
  THEN RETURN false; END IF;

  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id = p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.state IN ('COMPLETED', 'PARTIAL', 'FAILED') THEN
    RETURN v_job.completion_token = p_lease_token;
  END IF;
  IF v_job.state NOT IN ('LEASED', 'RUNNING')
    OR v_job.lease_owner <> p_worker_id OR v_job.lease_token <> p_lease_token
    OR v_job.lease_expires_at <= clock_timestamp()
  THEN RETURN false; END IF;

  UPDATE public.intentlead_jobs
    SET state = p_terminal_state, result = p_result, error = p_error,
        completed_at = clock_timestamp(), completion_token = p_lease_token,
        lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = p_job_id;
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
  v_state text;
BEGIN
  SELECT j.state INTO v_state
  FROM public.intentlead_jobs j
  JOIN public.workspaces w ON w.id = j.workspace_id
  WHERE j.id = p_job_id AND w.owner_id = p_user_id
  FOR UPDATE OF j, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF v_state IN ('COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED') THEN RETURN false; END IF;

  UPDATE public.intentlead_jobs
    SET state = 'CANCELLED', cancellation_requested_at = clock_timestamp(),
        cancelled_at = clock_timestamp(), lease_owner = NULL, lease_token = NULL,
        lease_expires_at = NULL, heartbeat_at = NULL
    WHERE id = p_job_id;
  RETURN true;
END;
$$;

DO $$
DECLARE
  v_signature regprocedure;
BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb)'::regprocedure,
    'public.intentlead_lease_next_job(text,integer)'::regprocedure,
    'public.intentlead_heartbeat_job(uuid,text,uuid,integer)'::regprocedure,
    'public.intentlead_checkpoint_job(uuid,text,uuid,jsonb)'::regprocedure,
    'public.intentlead_record_job_step_attempt(uuid,text,uuid,text,integer,text,uuid[],integer,text,jsonb,jsonb)'::regprocedure,
    'public.intentlead_retry_job(uuid,text,uuid,jsonb,timestamp with time zone)'::regprocedure,
    'public.intentlead_complete_job(uuid,text,uuid,text,jsonb,jsonb)'::regprocedure,
    'public.intentlead_cancel_job(uuid,uuid)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', v_signature);
  END LOOP;
END $$;

-- Review hardening: deterministic enqueue/completion identities, retry exhaustion and relational step provenance.
CREATE OR REPLACE FUNCTION public.intentlead_valid_capability_error(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT jsonb_typeof(p_value) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) key
      WHERE key <> ALL(ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs'])
    )
    AND p_value ?& ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs']
    AND p_value->>'schemaVersion' = '1'
    AND jsonb_typeof(p_value->'message') = 'string' AND btrim(p_value->>'message') <> ''
    AND p_value->>'capability' IN (
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW',
      'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
      'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
    )
    AND jsonb_typeof(p_value->'traceId') = 'string' AND btrim(p_value->>'traceId') <> ''
    AND jsonb_typeof(p_value->'retryable') = 'boolean'
    AND (
      (p_value->>'retryable' = 'true'
        AND p_value->>'code' IN ('RATE_LIMITED','TIMEOUT','DEPENDENCY_UNAVAILABLE')
        AND jsonb_typeof(p_value->'retryAfterMs') IN ('number','null')
        AND (jsonb_typeof(p_value->'retryAfterMs') = 'null' OR (p_value->>'retryAfterMs')::numeric >= 0))
      OR
      (p_value->>'retryable' = 'false'
        AND p_value->>'code' IN ('INVALID_INPUT','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','POLICY_DENIED',
          'CAPABILITY_UNAVAILABLE','BUDGET_EXCEEDED','CONFLICT','INTERNAL_ERROR')
        AND jsonb_typeof(p_value->'retryAfterMs') = 'null')
    )
$$;

ALTER TABLE public.intentlead_jobs
  ADD COLUMN input_hash text NOT NULL,
  ADD COLUMN completion_worker text,
  ADD COLUMN completion_fingerprint text,
  ADD CONSTRAINT intentlead_jobs_input_hash_check CHECK (input_hash ~ '^[0-9a-f]{32}$'),
  ADD CONSTRAINT intentlead_jobs_error_contract_check CHECK (
    error IS NULL OR public.intentlead_valid_capability_error(error)
  ),
  ADD CONSTRAINT intentlead_jobs_chronology_check CHECK (
    updated_at >= created_at
    AND (started_at IS NULL OR (started_at >= created_at AND started_at <= updated_at))
    AND (heartbeat_at IS NULL OR (started_at IS NOT NULL AND heartbeat_at >= started_at AND heartbeat_at <= updated_at))
    AND (lease_expires_at IS NULL OR lease_expires_at >= coalesce(heartbeat_at, updated_at))
    AND (state <> 'QUEUED' OR available_at >= created_at)
    AND (state <> 'RETRY_WAIT' OR available_at >= updated_at)
    AND (completed_at IS NULL OR (completed_at >= created_at AND completed_at <= updated_at))
    AND (cancelled_at IS NULL OR (cancelled_at >= created_at AND cancelled_at <= updated_at))
  ),
  ADD CONSTRAINT intentlead_jobs_completion_identity_check CHECK (
    (state IN ('COMPLETED','PARTIAL','FAILED') AND completion_token IS NOT NULL
      AND completion_worker IS NOT NULL AND completion_fingerprint ~ '^[0-9a-f]{32}$')
    OR (state NOT IN ('COMPLETED','PARTIAL','FAILED') AND completion_token IS NULL
      AND completion_worker IS NULL AND completion_fingerprint IS NULL)
  );

ALTER TABLE public.intentlead_job_step_attempts
  DROP COLUMN provider_run_ids,
  ADD CONSTRAINT intentlead_step_attempt_chronology_check CHECK (
    finished_at IS NULL OR finished_at >= started_at
  );

CREATE TABLE public.intentlead_job_step_provider_runs (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  step_attempt_id uuid NOT NULL,
  provider_run_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (step_attempt_id, provider_run_id),
  FOREIGN KEY (workspace_id, step_attempt_id)
    REFERENCES public.intentlead_job_step_attempts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, provider_run_id)
    REFERENCES public.intentlead_provider_runs(workspace_id, id)
);
ALTER TABLE public.intentlead_job_step_provider_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY intentlead_workspace_read ON public.intentlead_job_step_provider_runs
  FOR SELECT TO authenticated USING (public.intentlead_is_workspace_member(workspace_id));

REVOKE ALL ON TABLE public.intentlead_jobs, public.intentlead_job_step_attempts,
  public.intentlead_job_step_provider_runs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.intentlead_jobs, public.intentlead_job_step_attempts,
  public.intentlead_job_step_provider_runs TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_enqueue_discovery_job(
  p_discovery_brief_id uuid,
  p_user_id uuid,
  p_idempotency_key text,
  p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_job public.intentlead_jobs%ROWTYPE;
  v_input_hash text;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = ''
    OR p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
  THEN RAISE EXCEPTION 'invalid_enqueue_input'; END IF;
  v_input_hash := md5(p_discovery_brief_id::text || E'\nSOURCE_SEARCH\nOPPORTUNITY_DISCOVERY\n' || p_payload::text);

  SELECT b.* INTO v_brief
  FROM public.intentlead_discovery_briefs b
  JOIN public.workspaces w ON w.id = b.workspace_id
  WHERE b.id = p_discovery_brief_id AND w.owner_id = p_user_id
  FOR UPDATE OF b, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_job FROM public.intentlead_jobs
    WHERE workspace_id = v_brief.workspace_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_job.discovery_brief_id IS DISTINCT FROM p_discovery_brief_id
      OR v_job.capability <> 'SOURCE_SEARCH' OR v_job.job_type <> 'OPPORTUNITY_DISCOVERY'
      OR v_job.input_hash <> v_input_hash
    THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_job.id;
  END IF;

  IF v_brief.state <> 'DRAFT' THEN RAISE EXCEPTION 'brief_transition_denied'; END IF;
  IF v_brief.legacy_campaign_id IS NOT NULL THEN
    UPDATE public.campaigns SET status = 'running', updated_at = clock_timestamp()
      WHERE id = v_brief.legacy_campaign_id AND workspace_id = v_brief.workspace_id AND status = 'draft';
    IF NOT FOUND THEN RAISE EXCEPTION 'campaign_transition_denied'; END IF;
  END IF;
  INSERT INTO public.intentlead_jobs
    (workspace_id, discovery_brief_id, market_profile_key, capability, job_type, payload, idempotency_key, input_hash)
  VALUES (v_brief.workspace_id, v_brief.id,
    (SELECT profile_key FROM public.intentlead_market_profiles
      WHERE id = v_brief.market_profile_id AND workspace_id = v_brief.workspace_id),
    'SOURCE_SEARCH', 'OPPORTUNITY_DISCOVERY', p_payload, p_idempotency_key, v_input_hash)
  RETURNING * INTO v_job;
  UPDATE public.intentlead_discovery_briefs SET state = 'QUEUED' WHERE id = v_brief.id;
  RETURN v_job.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_lease_next_job(
  p_worker_id text,
  p_lease_seconds integer DEFAULT 60
) RETURNS SETOF public.intentlead_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id) = ''
    OR p_lease_seconds IS NULL OR p_lease_seconds < 5 OR p_lease_seconds > 3600
  THEN RAISE EXCEPTION 'invalid_lease_input'; END IF;

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
  WHERE state IN ('LEASED','RUNNING') AND lease_expires_at <= clock_timestamp()
    AND attempt >= max_attempts;

  SELECT id INTO v_job_id FROM public.intentlead_jobs
  WHERE attempt < max_attempts AND cancellation_requested_at IS NULL
    AND ((state = 'QUEUED' AND available_at <= clock_timestamp())
      OR (state = 'RETRY_WAIT' AND available_at <= clock_timestamp())
      OR (state IN ('LEASED','RUNNING') AND lease_expires_at <= clock_timestamp()))
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

CREATE OR REPLACE FUNCTION public.intentlead_record_job_step_attempt(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_step_key text,
  p_step_attempt integer, p_state text, p_provider_run_ids uuid[] DEFAULT '{}'::uuid[],
  p_timeout_ms integer DEFAULT NULL, p_retry_reason text DEFAULT NULL,
  p_checkpoint jsonb DEFAULT '{}'::jsonb, p_cost_scope jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_workspace_id uuid; v_job_attempt integer;
  v_existing public.intentlead_job_step_attempts%ROWTYPE; v_step_id uuid;
BEGIN
  IF p_step_key IS NULL OR btrim(p_step_key) = '' OR p_step_attempt IS NULL OR p_step_attempt <= 0
    OR p_state NOT IN ('STARTED','COMPLETED','RETRYABLE_FAILED','PERMANENT_FAILED','CANCELLED')
    OR p_provider_run_ids IS NULL OR (p_timeout_ms IS NOT NULL AND p_timeout_ms <= 0)
    OR p_checkpoint IS NULL OR jsonb_typeof(p_checkpoint) <> 'object'
    OR p_cost_scope IS NULL OR jsonb_typeof(p_cost_scope) <> 'object'
  THEN RAISE EXCEPTION 'invalid_step_attempt'; END IF;
  SELECT workspace_id, attempt INTO v_workspace_id, v_job_attempt FROM public.intentlead_jobs
    WHERE id = p_job_id AND lease_owner = p_worker_id AND lease_token = p_lease_token
      AND state IN ('LEASED','RUNNING') AND lease_expires_at > clock_timestamp() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF p_step_attempt <> v_job_attempt THEN RAISE EXCEPTION 'step_job_attempt_mismatch'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_provider_run_ids) run_id WHERE NOT EXISTS (
    SELECT 1 FROM public.intentlead_provider_runs pr
    WHERE pr.id = run_id AND pr.workspace_id = v_workspace_id AND pr.job_id = p_job_id
  )) THEN RAISE EXCEPTION 'step_provider_run_mismatch'; END IF;
  SELECT * INTO v_existing FROM public.intentlead_job_step_attempts
    WHERE job_id = p_job_id AND step_key = p_step_key AND attempt = p_step_attempt FOR UPDATE;
  IF FOUND THEN
    IF v_existing.state <> 'STARTED' AND v_existing.state <> p_state THEN RAISE EXCEPTION 'step_attempt_conflict'; END IF;
    UPDATE public.intentlead_job_step_attempts SET state=p_state, timeout_ms=p_timeout_ms,
      retry_reason=p_retry_reason, checkpoint=p_checkpoint, cost_scope=p_cost_scope,
      finished_at=CASE WHEN p_state='STARTED' THEN NULL ELSE clock_timestamp() END
      WHERE id=v_existing.id RETURNING id INTO v_step_id;
  ELSE
    INSERT INTO public.intentlead_job_step_attempts
      (workspace_id,job_id,step_key,attempt,state,timeout_ms,retry_reason,checkpoint,cost_scope,finished_at)
    VALUES (v_workspace_id,p_job_id,p_step_key,p_step_attempt,p_state,p_timeout_ms,p_retry_reason,
      p_checkpoint,p_cost_scope,CASE WHEN p_state='STARTED' THEN NULL ELSE clock_timestamp() END)
    RETURNING id INTO v_step_id;
  END IF;
  INSERT INTO public.intentlead_job_step_provider_runs(workspace_id,step_attempt_id,provider_run_id)
    SELECT v_workspace_id,v_step_id,run_id FROM unnest(p_provider_run_ids) run_id ON CONFLICT DO NOTHING;
  RETURN v_step_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_complete_job(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_terminal_state text,
  p_result jsonb, p_error jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_job public.intentlead_jobs%ROWTYPE; v_fingerprint text;
BEGIN
  IF p_worker_id IS NULL OR btrim(p_worker_id)='' OR p_lease_token IS NULL
    OR p_terminal_state NOT IN ('COMPLETED','PARTIAL','FAILED')
    OR (p_result IS NOT NULL AND jsonb_typeof(p_result)<>'object')
    OR (p_error IS NOT NULL AND jsonb_typeof(p_error)<>'object')
    OR (p_terminal_state='COMPLETED' AND (p_result IS NULL OR p_error IS NOT NULL))
    OR (p_terminal_state='PARTIAL' AND (p_result IS NULL OR p_error IS NULL))
    OR (p_terminal_state='FAILED' AND p_error IS NULL) THEN RETURN false; END IF;
  v_fingerprint := md5(p_worker_id||E'\n'||p_lease_token::text||E'\n'||p_terminal_state||E'\n'
    ||coalesce(p_result::text,'null')||E'\n'||coalesce(p_error::text,'null'));
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_job.state IN ('COMPLETED','PARTIAL','FAILED') THEN
    RETURN v_job.completion_token=p_lease_token AND v_job.completion_worker=p_worker_id
      AND v_job.completion_fingerprint=v_fingerprint;
  END IF;
  IF v_job.state NOT IN ('LEASED','RUNNING') OR v_job.lease_owner<>p_worker_id
    OR v_job.lease_token<>p_lease_token OR v_job.lease_expires_at<=clock_timestamp() THEN RETURN false; END IF;
  UPDATE public.intentlead_jobs SET state=p_terminal_state,result=p_result,error=p_error,
    completed_at=clock_timestamp(),completion_token=p_lease_token,completion_worker=p_worker_id,
    completion_fingerprint=v_fingerprint,lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,heartbeat_at=NULL
    WHERE id=p_job_id;
  RETURN true;
END;
$$;

DO $$ DECLARE v_signature regprocedure; BEGIN
  FOREACH v_signature IN ARRAY ARRAY[
    'public.intentlead_enqueue_discovery_job(uuid,uuid,text,jsonb)'::regprocedure,
    'public.intentlead_lease_next_job(text,integer)'::regprocedure,
    'public.intentlead_heartbeat_job(uuid,text,uuid,integer)'::regprocedure,
    'public.intentlead_checkpoint_job(uuid,text,uuid,jsonb)'::regprocedure,
    'public.intentlead_record_job_step_attempt(uuid,text,uuid,text,integer,text,uuid[],integer,text,jsonb,jsonb)'::regprocedure,
    'public.intentlead_retry_job(uuid,text,uuid,jsonb,timestamp with time zone)'::regprocedure,
    'public.intentlead_complete_job(uuid,text,uuid,text,jsonb,jsonb)'::regprocedure,
    'public.intentlead_cancel_job(uuid,uuid)'::regprocedure
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',v_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',v_signature);
  END LOOP;
END $$;
