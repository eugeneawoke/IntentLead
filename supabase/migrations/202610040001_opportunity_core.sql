-- Task 4: additive Opportunity Core persistence in the shared public schema.
-- All objects owned by this migration use the intentlead_ prefix. Legacy tables stay intact.

CREATE OR REPLACE FUNCTION public.intentlead_is_workspace_owner(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND owner_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.intentlead_is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_id = auth.uid()
    UNION ALL
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = auth.uid()
  )
$$;

REVOKE ALL ON FUNCTION public.intentlead_is_workspace_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.intentlead_is_workspace_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intentlead_is_workspace_owner(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_is_workspace_member(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = TG_RELID))
    AND (session_user = 'service_role' OR current_setting('role', true) = 'service_role')
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'intentlead_append_only:%', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

CREATE TABLE public.intentlead_offer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  name text NOT NULL CHECK (btrim(name) <> ''),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name, version)
);

CREATE TABLE public.intentlead_icp_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  name text NOT NULL CHECK (btrim(name) <> ''),
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, name, version)
);

CREATE TABLE public.intentlead_market_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  profile_key text NOT NULL CHECK (profile_key IN ('EN_DISCOVERY_ONLY', 'CIS_RU', 'LOCAL_CUSTOM')),
  workflow text NOT NULL CHECK (workflow IN ('DISCOVERY_ONLY', 'ASSISTED_OUTREACH')),
  configuration jsonb NOT NULL CHECK (jsonb_typeof(configuration) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, profile_key, version),
  CHECK (profile_key <> 'EN_DISCOVERY_ONLY' OR workflow = 'DISCOVERY_ONLY')
);

CREATE TABLE public.intentlead_discovery_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  offer_profile_id uuid NOT NULL,
  icp_definition_id uuid NOT NULL,
  market_profile_id uuid NOT NULL,
  legacy_campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  objective text NOT NULL CHECK (btrim(objective) <> ''),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'object'),
  state text NOT NULL DEFAULT 'DRAFT'
    CHECK (state IN ('DRAFT', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, offer_profile_id)
    REFERENCES public.intentlead_offer_profiles(workspace_id, id),
  FOREIGN KEY (workspace_id, icp_definition_id)
    REFERENCES public.intentlead_icp_definitions(workspace_id, id),
  FOREIGN KEY (workspace_id, market_profile_id)
    REFERENCES public.intentlead_market_profiles(workspace_id, id)
);

CREATE TABLE public.intentlead_provider_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  capability text NOT NULL CHECK (btrim(capability) <> ''),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  provider_version text,
  status text NOT NULL CHECK (status IN ('STARTED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'RATE_LIMITED', 'TIMEOUT')),
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(request_metadata) = 'object'),
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(response_metadata) = 'object'),
  latency_ms integer CHECK (latency_ms IS NULL OR latency_ms >= 0),
  usage_units numeric CHECK (usage_units IS NULL OR usage_units >= 0),
  cost_amount numeric CHECK (cost_amount IS NULL OR cost_amount >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  CHECK (finished_at IS NULL OR finished_at >= started_at)
);

CREATE TABLE public.intentlead_source_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  provider text NOT NULL CHECK (btrim(provider) <> ''),
  external_id text NOT NULL CHECK (btrim(external_id) <> ''),
  provider_run_id uuid,
  source_url text,
  content text,
  normalized_facts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(normalized_facts) = 'object'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  captured_at timestamptz NOT NULL,
  published_at timestamptz,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, provider, external_id),
  FOREIGN KEY (workspace_id, provider_run_id)
    REFERENCES public.intentlead_provider_runs(workspace_id, id),
  CHECK (content IS NOT NULL OR normalized_facts <> '{}'::jsonb)
);

CREATE TABLE public.intentlead_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  canonical_name text NOT NULL CHECK (btrim(canonical_name) <> ''),
  domain text,
  jurisdiction jsonb CHECK (jurisdiction IS NULL OR jsonb_typeof(jurisdiction) = 'object'),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id)
);
CREATE UNIQUE INDEX intentlead_companies_workspace_domain_idx
  ON public.intentlead_companies(workspace_id, lower(domain)) WHERE domain IS NOT NULL;

CREATE TABLE public.intentlead_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  company_id uuid,
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  role_title text,
  jurisdiction jsonb CHECK (jurisdiction IS NULL OR jsonb_typeof(jurisdiction) = 'object'),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  tombstoned_at timestamptz,
  resolved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, company_id)
    REFERENCES public.intentlead_companies(workspace_id, id)
);

CREATE TABLE public.intentlead_artifact_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  source_item_id uuid,
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  storage_reference text NOT NULL CHECK (btrim(storage_reference) <> ''),
  media_type text NOT NULL CHECK (media_type ~ '^[[:alnum:].+-]+/[[:alnum:].+-]+$'),
  size_bytes bigint NOT NULL CHECK (size_bytes >= 0),
  access_class text NOT NULL DEFAULT 'WORKSPACE_PRIVATE' CHECK (access_class = 'WORKSPACE_PRIVATE'),
  retention_policy_id text NOT NULL CHECK (btrim(retention_policy_id) <> ''),
  expires_at timestamptz,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, content_hash),
  FOREIGN KEY (workspace_id, source_item_id)
    REFERENCES public.intentlead_source_items(workspace_id, id),
  CHECK (expires_at IS NULL OR expires_at >= created_at)
);

CREATE TABLE public.intentlead_evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  source_item_id uuid,
  artifact_id uuid,
  evidence_type text NOT NULL CHECK (evidence_type IN ('text', 'structured_fact', 'screenshot', 'document', 'observation')),
  source_url text,
  captured_at timestamptz NOT NULL,
  excerpt text,
  structured_facts jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(structured_facts) = 'object'),
  verification_method text NOT NULL CHECK (btrim(verification_method) <> ''),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-fA-F]{64}$'),
  provenance jsonb NOT NULL CHECK (jsonb_typeof(provenance) = 'object'),
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, content_hash),
  FOREIGN KEY (workspace_id, source_item_id)
    REFERENCES public.intentlead_source_items(workspace_id, id),
  FOREIGN KEY (workspace_id, artifact_id)
    REFERENCES public.intentlead_artifact_metadata(workspace_id, id),
  CHECK (tombstoned_at IS NOT NULL OR excerpt IS NOT NULL OR structured_facts <> '{}'::jsonb OR artifact_id IS NOT NULL)
);

CREATE TABLE public.intentlead_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  discovery_brief_id uuid NOT NULL,
  company_id uuid,
  market_profile_key text NOT NULL CHECK (market_profile_key IN ('EN_DISCOVERY_ONLY', 'CIS_RU', 'LOCAL_CUSTOM')),
  state text NOT NULL CHECK (state IN (
    'DISCOVERED', 'ENRICHING', 'ASSESSABLE', 'INSUFFICIENT_EVIDENCE', 'PACKAGE_READY', 'MODEL_REJECTED',
    'HUMAN_REVIEW', 'OUTREACH_READY', 'REJECTED', 'NEEDS_RESEARCH', 'CONTACTED', 'REPLIED',
    'NO_REPLY', 'OPTED_OUT', 'POSITIVE_REPLY', 'NEGATIVE_REPLY', 'MEETING', 'SALES_OPPORTUNITY',
    'CUSTOMER', 'CLOSED'
  )),
  signal jsonb NOT NULL CHECK (jsonb_typeof(signal) = 'object'),
  jurisdiction jsonb CHECK (jurisdiction IS NULL OR jsonb_typeof(jurisdiction) = 'object'),
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, discovery_brief_id)
    REFERENCES public.intentlead_discovery_briefs(workspace_id, id),
  FOREIGN KEY (workspace_id, company_id)
    REFERENCES public.intentlead_companies(workspace_id, id),
  CHECK (market_profile_key <> 'EN_DISCOVERY_ONLY' OR state IN (
    'DISCOVERED', 'ENRICHING', 'ASSESSABLE', 'INSUFFICIENT_EVIDENCE', 'PACKAGE_READY',
    'MODEL_REJECTED', 'HUMAN_REVIEW', 'REJECTED', 'NEEDS_RESEARCH', 'CLOSED'
  ))
);

CREATE TABLE public.intentlead_opportunity_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_id, evidence_id),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id)
    REFERENCES public.intentlead_evidence_items(workspace_id, id)
);

CREATE TABLE public.intentlead_opportunity_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  decision text NOT NULL CHECK (decision IN ('QUALIFY', 'REVIEW', 'REJECT')),
  assessment jsonb NOT NULL CHECK (jsonb_typeof(assessment) = 'object'),
  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  model_run_id uuid,
  assessed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (opportunity_id, version),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id),
  FOREIGN KEY (workspace_id, model_run_id)
    REFERENCES public.intentlead_provider_runs(workspace_id, id)
);

CREATE TABLE public.intentlead_buyer_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  company_id uuid NOT NULL,
  person_id uuid,
  role_title text NOT NULL CHECK (btrim(role_title) <> ''),
  hypothesis text NOT NULL CHECK (btrim(hypothesis) <> ''),
  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  relevance numeric NOT NULL CHECK (relevance BETWEEN 0 AND 1),
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id),
  FOREIGN KEY (workspace_id, company_id)
    REFERENCES public.intentlead_companies(workspace_id, id),
  FOREIGN KEY (workspace_id, person_id)
    REFERENCES public.intentlead_people(workspace_id, id)
);

CREATE TABLE public.intentlead_contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  person_id uuid,
  company_id uuid,
  channel text NOT NULL CHECK (channel IN ('email', 'profile', 'phone')),
  value text,
  value_hash text NOT NULL CHECK (value_hash ~ '^[0-9a-fA-F]{64}$'),
  jurisdiction jsonb NOT NULL CHECK (jsonb_typeof(jurisdiction) = 'object'),
  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  captured_at timestamptz NOT NULL,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, channel, value_hash),
  FOREIGN KEY (workspace_id, person_id)
    REFERENCES public.intentlead_people(workspace_id, id),
  FOREIGN KEY (workspace_id, company_id)
    REFERENCES public.intentlead_companies(workspace_id, id),
  CHECK (person_id IS NOT NULL OR company_id IS NOT NULL),
  CHECK (value IS NOT NULL OR tombstoned_at IS NOT NULL)
);

CREATE TABLE public.intentlead_contact_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  contact_point_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('VALID', 'INVALID', 'RISKY', 'UNKNOWN')),
  verification_method text NOT NULL CHECK (btrim(verification_method) <> ''),
  confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  evidence_ids uuid[] NOT NULL CHECK (cardinality(evidence_ids) > 0),
  checked_at timestamptz NOT NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, contact_point_id)
    REFERENCES public.intentlead_contact_points(workspace_id, id),
  CHECK (expires_at IS NULL OR expires_at >= checked_at)
);

CREATE TABLE public.intentlead_verification_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  version integer NOT NULL CHECK (version > 0),
  market_profile_key text NOT NULL CHECK (market_profile_key IN ('EN_DISCOVERY_ONLY', 'CIS_RU', 'LOCAL_CUSTOM')),
  workflow text NOT NULL CHECK (workflow IN ('DISCOVERY_ONLY', 'ASSISTED_OUTREACH')),
  package_verified_allowed boolean NOT NULL,
  checks jsonb NOT NULL CHECK (
    jsonb_typeof(checks) = 'object'
    AND checks ?& ARRAY['evidence','company','buyer','contact','grounded_draft','suppression','market_workflow']
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, market_profile_key, workflow, version),
  CHECK (market_profile_key <> 'EN_DISCOVERY_ONLY' OR (workflow = 'DISCOVERY_ONLY' AND NOT package_verified_allowed)),
  CHECK (NOT package_verified_allowed OR workflow = 'ASSISTED_OUTREACH')
);

CREATE TABLE public.intentlead_verified_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  policy_id uuid NOT NULL,
  policy_version integer NOT NULL CHECK (policy_version > 0),
  market_profile_key text NOT NULL CHECK (market_profile_key IN ('EN_DISCOVERY_ONLY', 'CIS_RU', 'LOCAL_CUSTOM')),
  workflow text NOT NULL CHECK (workflow IN ('DISCOVERY_ONLY', 'ASSISTED_OUTREACH')),
  status text NOT NULL CHECK (status IN ('PENDING', 'FAILED', 'VERIFIED')),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, idempotency_key),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id),
  FOREIGN KEY (workspace_id, policy_id)
    REFERENCES public.intentlead_verification_policies(workspace_id, id),
  CHECK ((status = 'VERIFIED') = (verified_at IS NOT NULL))
);

CREATE TABLE public.intentlead_package_check_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  package_id uuid NOT NULL,
  check_name text NOT NULL CHECK (check_name IN (
    'evidence', 'company', 'buyer', 'contact', 'grounded_draft', 'suppression', 'market_workflow'
  )),
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL')),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  reference_ids uuid[] NOT NULL CHECK (cardinality(reference_ids) > 0),
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (package_id, check_name),
  FOREIGN KEY (workspace_id, package_id)
    REFERENCES public.intentlead_verified_packages(workspace_id, id)
);

CREATE TABLE public.intentlead_suppression_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  identifier_type text NOT NULL CHECK (identifier_type IN ('EMAIL', 'PHONE', 'PROFILE', 'PERSON', 'COMPANY')),
  identifier_hash text NOT NULL CHECK (identifier_hash ~ '^[0-9a-fA-F]{64}$'),
  reason text NOT NULL CHECK (reason IN ('OPT_OUT', 'COMPLAINT', 'POLICY')),
  policy_id text NOT NULL CHECK (btrim(policy_id) <> ''),
  retain_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, identifier_type, identifier_hash),
  CHECK (retain_until IS NULL OR retain_until >= created_at)
);

CREATE TABLE public.intentlead_human_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  reviewer_id uuid NOT NULL REFERENCES auth.users(id),
  decision text NOT NULL CHECK (decision IN ('ACCEPTED', 'REJECTED', 'NEEDS_RESEARCH')),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  note text,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id)
);

CREATE TABLE public.intentlead_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  outcome_type text NOT NULL CHECK (outcome_type IN (
    'CONTACTED', 'REPLIED', 'NO_REPLY', 'OPTED_OUT', 'POSITIVE_REPLY', 'NEGATIVE_REPLY',
    'MEETING', 'SALES_OPPORTUNITY', 'CUSTOMER', 'CLOSED'
  )),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  recorded_by uuid NOT NULL REFERENCES auth.users(id),
  occurred_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, opportunity_id)
    REFERENCES public.intentlead_opportunities(workspace_id, id)
);

CREATE TABLE public.intentlead_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  event_type text NOT NULL CHECK (event_type IN ('PROVIDER_COST', 'MODEL_COST', 'PACKAGE_VERIFIED')),
  provider_run_id uuid,
  verified_package_id uuid,
  amount numeric NOT NULL DEFAULT 0 CHECK (amount >= 0),
  currency text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  customer_credit_delta integer NOT NULL DEFAULT 0 CHECK (customer_credit_delta <= 0),
  idempotency_key text NOT NULL CHECK (btrim(idempotency_key) <> ''),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (workspace_id, event_type, idempotency_key),
  FOREIGN KEY (workspace_id, provider_run_id)
    REFERENCES public.intentlead_provider_runs(workspace_id, id),
  FOREIGN KEY (workspace_id, verified_package_id)
    REFERENCES public.intentlead_verified_packages(workspace_id, id),
  CHECK (
    (event_type = 'PACKAGE_VERIFIED' AND verified_package_id IS NOT NULL AND customer_credit_delta = -1)
    OR (event_type <> 'PACKAGE_VERIFIED' AND verified_package_id IS NULL AND customer_credit_delta = 0)
  )
);

CREATE TABLE public.intentlead_deletion_tombstones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  resource_type text NOT NULL CHECK (resource_type IN ('OPPORTUNITY')),
  resource_id uuid NOT NULL,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, resource_type, resource_id)
);

CREATE INDEX intentlead_discovery_briefs_workspace_state_idx
  ON public.intentlead_discovery_briefs(workspace_id, state, created_at DESC);
CREATE INDEX intentlead_source_items_workspace_captured_idx
  ON public.intentlead_source_items(workspace_id, captured_at DESC);
CREATE INDEX intentlead_evidence_items_workspace_source_idx
  ON public.intentlead_evidence_items(workspace_id, source_item_id);
CREATE INDEX intentlead_opportunities_workspace_state_idx
  ON public.intentlead_opportunities(workspace_id, state, updated_at DESC);
CREATE INDEX intentlead_assessments_opportunity_version_idx
  ON public.intentlead_opportunity_assessments(opportunity_id, version DESC);
CREATE INDEX intentlead_contact_verifications_contact_checked_idx
  ON public.intentlead_contact_verifications(contact_point_id, checked_at DESC);
CREATE INDEX intentlead_suppression_workspace_hash_idx
  ON public.intentlead_suppression_entries(workspace_id, identifier_hash);
CREATE INDEX intentlead_provider_runs_workspace_started_idx
  ON public.intentlead_provider_runs(workspace_id, started_at DESC);
CREATE INDEX intentlead_cost_events_workspace_occurred_idx
  ON public.intentlead_cost_events(workspace_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION public.intentlead_assert_opportunity_has_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_opportunity_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'intentlead_opportunities' THEN
    v_opportunity_id := NEW.id;
  ELSE
    v_opportunity_id := OLD.opportunity_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.intentlead_opportunities WHERE id = v_opportunity_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence WHERE opportunity_id = v_opportunity_id
    )
  THEN RAISE EXCEPTION 'opportunity_requires_evidence'; END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER intentlead_opportunity_requires_evidence
  AFTER INSERT OR UPDATE ON public.intentlead_opportunities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_opportunity_has_evidence();
CREATE CONSTRAINT TRIGGER intentlead_opportunity_link_preserves_evidence
  AFTER DELETE OR UPDATE ON public.intentlead_opportunity_evidence
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_opportunity_has_evidence();

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_offer_profiles', 'intentlead_icp_definitions', 'intentlead_market_profiles',
    'intentlead_discovery_briefs', 'intentlead_provider_runs', 'intentlead_source_items',
    'intentlead_companies', 'intentlead_people', 'intentlead_artifact_metadata',
    'intentlead_evidence_items', 'intentlead_opportunities', 'intentlead_opportunity_evidence',
    'intentlead_opportunity_assessments', 'intentlead_buyer_candidates', 'intentlead_contact_points',
    'intentlead_contact_verifications', 'intentlead_verification_policies', 'intentlead_verified_packages',
    'intentlead_package_check_results', 'intentlead_suppression_entries', 'intentlead_human_reviews',
    'intentlead_outcomes', 'intentlead_cost_events', 'intentlead_deletion_tombstones'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'CREATE POLICY intentlead_workspace_read ON public.%I FOR SELECT TO authenticated USING (public.intentlead_is_workspace_member(workspace_id))',
      v_table
    );
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END $$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_offer_profiles', 'intentlead_icp_definitions', 'intentlead_market_profiles'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY intentlead_owner_config_write ON public.%I FOR ALL TO authenticated USING (public.intentlead_is_workspace_owner(workspace_id)) WITH CHECK (public.intentlead_is_workspace_owner(workspace_id))',
      v_table
    );
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
END $$;

CREATE POLICY intentlead_member_review_insert
  ON public.intentlead_human_reviews FOR INSERT TO authenticated
  WITH CHECK (
    public.intentlead_is_workspace_member(workspace_id)
    AND reviewer_id = auth.uid()
  );
GRANT INSERT ON TABLE public.intentlead_human_reviews TO authenticated;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_offer_profiles', 'intentlead_icp_definitions', 'intentlead_market_profiles',
    'intentlead_discovery_briefs', 'intentlead_companies', 'intentlead_people',
    'intentlead_contact_points', 'intentlead_opportunities', 'intentlead_verified_packages'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER intentlead_touch_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.intentlead_touch_updated_at()',
      v_table
    );
  END LOOP;
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_source_items', 'intentlead_artifact_metadata', 'intentlead_evidence_items',
    'intentlead_opportunity_assessments', 'intentlead_contact_verifications',
    'intentlead_verification_policies', 'intentlead_package_check_results', 'intentlead_suppression_entries',
    'intentlead_human_reviews', 'intentlead_outcomes', 'intentlead_provider_runs', 'intentlead_cost_events',
    'intentlead_deletion_tombstones'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER intentlead_append_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.intentlead_reject_audit_mutation()',
      v_table
    );
  END LOOP;
END $$;

-- Deletion obligations use the owner-authorized tombstone RPC, never a broad service delete.
REVOKE DELETE ON TABLE public.intentlead_opportunities FROM service_role;

CREATE OR REPLACE FUNCTION public.intentlead_tombstone_opportunity(
  p_opportunity_id uuid,
  p_user_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'invalid_tombstone_reason';
  END IF;

  SELECT o.workspace_id INTO v_workspace_id
  FROM public.intentlead_opportunities o
  JOIN public.workspaces w ON w.id = o.workspace_id
  WHERE o.id = p_opportunity_id AND w.owner_id = p_user_id
  FOR UPDATE OF o, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.intentlead_opportunities
    SET tombstoned_at = coalesce(tombstoned_at, clock_timestamp()),
        state = 'CLOSED', signal = '{"tombstoned":true}'::jsonb
    WHERE id = p_opportunity_id;
  UPDATE public.intentlead_evidence_items e
    SET excerpt = NULL, structured_facts = '{}'::jsonb,
        tombstoned_at = coalesce(e.tombstoned_at, clock_timestamp())
    WHERE e.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_opportunity_evidence oe
        WHERE oe.opportunity_id = p_opportunity_id AND oe.evidence_id = e.id
      );
  UPDATE public.intentlead_source_items s
    SET content = NULL, normalized_facts = '{"tombstoned":true}'::jsonb,
        tombstoned_at = coalesce(s.tombstoned_at, clock_timestamp())
    WHERE s.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items e
        JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id = e.id
        WHERE oe.opportunity_id = p_opportunity_id AND e.source_item_id = s.id
      );
  UPDATE public.intentlead_artifact_metadata a
    SET storage_reference = 'deleted://tombstone', size_bytes = 0,
        tombstoned_at = coalesce(a.tombstoned_at, clock_timestamp())
    WHERE a.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items e
        JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id = e.id
        WHERE oe.opportunity_id = p_opportunity_id AND e.artifact_id = a.id
      );
  UPDATE public.intentlead_buyer_candidates
    SET hypothesis = '[deleted]', tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;

  INSERT INTO public.intentlead_deletion_tombstones
    (workspace_id, resource_type, resource_id, reason, requested_by)
  VALUES (v_workspace_id, 'OPPORTUNITY', p_opportunity_id, p_reason, p_user_id)
  ON CONFLICT (workspace_id, resource_type, resource_id) DO NOTHING;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_charge_verified_package(
  p_package_id uuid,
  p_user_id uuid,
  p_idempotency_key text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_package public.intentlead_verified_packages%ROWTYPE;
  v_policy public.intentlead_verification_policies%ROWTYPE;
  v_workspace public.workspaces%ROWTYPE;
  v_opportunity public.intentlead_opportunities%ROWTYPE;
  v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_market public.intentlead_market_profiles%ROWTYPE;
  v_event_id uuid;
  v_check_count integer;
  v_pass_count integer;
  v_check_id uuid;
  v_company_id uuid;
  v_buyer_id uuid;
  v_contact_verification_id uuid;
  v_contact_point_id uuid;
  v_draft_id uuid;
  v_suppression_decision_id uuid;
  v_market_check_id uuid;
  v_evidence_count integer;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN RAISE EXCEPTION 'invalid_idempotency_key'; END IF;

  SELECT p.* INTO v_package
  FROM public.intentlead_verified_packages p
  JOIN public.workspaces w ON w.id = p.workspace_id
  WHERE p.id = p_package_id AND w.owner_id = p_user_id AND p.tombstoned_at IS NULL
  FOR UPDATE OF p, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT * INTO v_workspace FROM public.workspaces WHERE id = v_package.workspace_id FOR UPDATE;

  SELECT id INTO v_event_id FROM public.intentlead_cost_events
  WHERE workspace_id = v_package.workspace_id AND event_type = 'PACKAGE_VERIFIED'
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.intentlead_cost_events WHERE id = v_event_id AND verified_package_id = p_package_id)
    THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_event_id;
  END IF;
  IF v_package.status = 'VERIFIED' THEN RAISE EXCEPTION 'package_already_charged'; END IF;
  IF v_package.status <> 'PENDING' THEN RAISE EXCEPTION 'package_not_chargeable'; END IF;

  SELECT * INTO v_opportunity FROM public.intentlead_opportunities
    WHERE id = v_package.opportunity_id AND workspace_id = v_package.workspace_id
    FOR UPDATE;
  IF NOT FOUND OR v_opportunity.tombstoned_at IS NOT NULL
    OR v_opportunity.state NOT IN ('PACKAGE_READY','HUMAN_REVIEW','OUTREACH_READY')
    OR v_opportunity.company_id IS NULL OR v_opportunity.current_assessment_id IS NULL
  THEN RAISE EXCEPTION 'package_not_chargeable'; END IF;
  SELECT * INTO v_brief FROM public.intentlead_discovery_briefs
    WHERE id = v_opportunity.discovery_brief_id AND workspace_id = v_package.workspace_id;
  SELECT * INTO v_market FROM public.intentlead_market_profiles
    WHERE id = v_brief.market_profile_id AND workspace_id = v_package.workspace_id
    FOR SHARE;
  IF NOT FOUND OR v_market.profile_key = 'EN_DISCOVERY_ONLY' OR v_market.workflow <> 'ASSISTED_OUTREACH'
  THEN RAISE EXCEPTION 'package_verification_disabled'; END IF;

  SELECT * INTO v_policy FROM public.intentlead_verification_policies
    WHERE id = v_package.policy_id AND workspace_id = v_package.workspace_id
      AND version = v_package.policy_version FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification_policy_not_found'; END IF;
  IF NOT v_policy.package_verified_allowed OR v_policy.workflow <> v_market.workflow
    OR v_policy.market_profile_key <> v_market.profile_key
    OR jsonb_array_length(v_policy.jurisdictions) = 0
    OR NOT (v_market.capabilities @> v_policy.market_required_capabilities)
  THEN RAISE EXCEPTION 'package_verification_disabled'; END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'PASS')
    INTO v_check_count, v_pass_count
  FROM public.intentlead_package_check_results
  WHERE package_id = p_package_id AND workspace_id = v_package.workspace_id
    AND tombstoned_at IS NULL;
  IF v_check_count <> 7 THEN RAISE EXCEPTION 'verification_checks_incomplete'; END IF;
  IF v_pass_count <> 7 THEN RAISE EXCEPTION 'verification_checks_failed'; END IF;

  SELECT id INTO v_check_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'evidence' AND status = 'PASS';
  SELECT count(*) INTO v_evidence_count
  FROM public.intentlead_package_check_evidence pce
  JOIN public.intentlead_evidence_items e ON e.id = pce.evidence_id AND e.workspace_id = pce.workspace_id
  JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id = e.id
    AND oe.workspace_id = e.workspace_id AND oe.opportunity_id = v_opportunity.id
  WHERE pce.package_check_id = v_check_id AND pce.workspace_id = v_package.workspace_id
    AND e.tombstoned_at IS NULL AND oe.tombstoned_at IS NULL
    AND e.confidence >= v_policy.evidence_min_strength
    AND e.captured_at >= (SELECT evaluated_at FROM public.intentlead_package_check_results WHERE id = v_check_id)
      - v_policy.evidence_max_age_days * interval '1 day';
  IF v_evidence_count < v_policy.evidence_min_items THEN RAISE EXCEPTION 'verification_reference_invalid:evidence'; END IF;

  SELECT company_id INTO v_company_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'company' AND status = 'PASS';
  IF v_company_id IS DISTINCT FROM v_opportunity.company_id OR NOT EXISTS (
    SELECT 1 FROM public.intentlead_companies c WHERE c.id = v_company_id
      AND c.workspace_id = v_package.workspace_id AND c.tombstoned_at IS NULL
      AND c.confidence >= v_policy.company_min_confidence
  ) THEN RAISE EXCEPTION 'verification_reference_invalid:company'; END IF;

  SELECT buyer_candidate_id INTO v_buyer_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'buyer' AND status = 'PASS';
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_buyer_candidates b WHERE b.id = v_buyer_id
      AND b.workspace_id = v_package.workspace_id AND b.opportunity_id = v_opportunity.id
      AND b.company_id = v_opportunity.company_id AND b.tombstoned_at IS NULL
      AND b.confidence >= v_policy.buyer_min_confidence AND b.relevance >= v_policy.buyer_min_relevance
      AND EXISTS (
        SELECT 1 FROM public.intentlead_buyer_candidate_evidence be
        JOIN public.intentlead_opportunity_evidence oe
          ON oe.evidence_id = be.evidence_id AND oe.workspace_id = be.workspace_id
        JOIN public.intentlead_evidence_items e
          ON e.id = oe.evidence_id AND e.workspace_id = oe.workspace_id
        WHERE be.buyer_candidate_id = b.id AND oe.opportunity_id = v_opportunity.id
          AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL
      )
  ) THEN RAISE EXCEPTION 'verification_reference_invalid:buyer'; END IF;

  SELECT contact_verification_id INTO v_contact_verification_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'contact' AND status = 'PASS';
  SELECT cv.contact_point_id INTO v_contact_point_id
  FROM public.intentlead_contact_verifications cv
  JOIN public.intentlead_contact_points cp ON cp.id = cv.contact_point_id AND cp.workspace_id = cv.workspace_id
  LEFT JOIN public.intentlead_buyer_candidates b ON b.id = v_buyer_id AND b.workspace_id = cv.workspace_id
  WHERE cv.id = v_contact_verification_id AND cv.workspace_id = v_package.workspace_id
    AND cv.tombstoned_at IS NULL AND cp.tombstoned_at IS NULL
    AND cv.status = ANY(v_policy.contact_accepted_statuses)
    AND cv.checked_at >= (SELECT evaluated_at FROM public.intentlead_package_check_results WHERE id = (
      SELECT id FROM public.intentlead_package_check_results WHERE package_id = p_package_id AND check_name = 'contact'
    )) - v_policy.contact_max_age_days * interval '1 day'
    AND (cv.expires_at IS NULL OR cv.expires_at >= clock_timestamp())
    AND (cp.company_id = v_opportunity.company_id OR (b.person_id IS NOT NULL AND cp.person_id = b.person_id))
    AND EXISTS (
      SELECT 1 FROM public.intentlead_contact_point_evidence cpe
      JOIN public.intentlead_opportunity_evidence oe
        ON oe.evidence_id = cpe.evidence_id AND oe.workspace_id = cpe.workspace_id
      WHERE cpe.contact_point_id = cp.id AND oe.opportunity_id = v_opportunity.id
        AND oe.tombstoned_at IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM public.intentlead_contact_verification_evidence cve
      JOIN public.intentlead_opportunity_evidence oe
        ON oe.evidence_id = cve.evidence_id AND oe.workspace_id = cve.workspace_id
      WHERE cve.contact_verification_id = cv.id AND oe.opportunity_id = v_opportunity.id
        AND oe.tombstoned_at IS NULL
    );
  IF v_contact_point_id IS NULL THEN RAISE EXCEPTION 'verification_reference_invalid:contact'; END IF;

  SELECT outreach_draft_id INTO v_draft_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'grounded_draft' AND status = 'PASS';
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_outreach_drafts d WHERE d.id = v_draft_id
      AND d.workspace_id = v_package.workspace_id AND d.opportunity_id = v_opportunity.id
      AND d.status = 'GROUNDED' AND d.tombstoned_at IS NULL
  ) OR NOT EXISTS (SELECT 1 FROM public.intentlead_outreach_draft_claims WHERE draft_id = v_draft_id)
    OR EXISTS (
      SELECT 1 FROM public.intentlead_outreach_draft_claims c
      WHERE c.draft_id = v_draft_id AND (
        c.tombstoned_at IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM public.intentlead_opportunity_evidence oe
          JOIN public.intentlead_evidence_items e ON e.id = oe.evidence_id
          WHERE oe.opportunity_id = v_opportunity.id AND oe.evidence_id = c.evidence_id
            AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL
        )
      )
    )
  THEN RAISE EXCEPTION 'verification_reference_invalid:grounded_draft'; END IF;

  SELECT suppression_decision_id INTO v_suppression_decision_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'suppression' AND status = 'PASS';
  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_suppression_decisions sd
    WHERE sd.id = v_suppression_decision_id AND sd.workspace_id = v_package.workspace_id
      AND sd.opportunity_id = v_opportunity.id AND sd.contact_point_id = v_contact_point_id
      AND sd.decision = 'CLEAR' AND sd.tombstoned_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.intentlead_suppression_entries se
    JOIN public.intentlead_contact_points cp ON cp.value_hash = se.identifier_hash AND cp.workspace_id = se.workspace_id
    WHERE cp.id = v_contact_point_id AND se.workspace_id = v_package.workspace_id
  ) THEN RAISE EXCEPTION 'verification_reference_invalid:suppression'; END IF;

  SELECT market_profile_id INTO v_market_check_id FROM public.intentlead_package_check_results
    WHERE package_id = p_package_id AND check_name = 'market_workflow' AND status = 'PASS';
  IF v_market_check_id IS DISTINCT FROM v_market.id THEN RAISE EXCEPTION 'verification_reference_invalid:market_workflow'; END IF;

  IF v_workspace.credits_remaining <= 0 OR (v_workspace.plan = 'free' AND v_workspace.free_converter_used)
  THEN RAISE EXCEPTION 'insufficient_credits'; END IF;
  UPDATE public.workspaces SET credits_remaining = credits_remaining - 1,
    free_converter_used = CASE WHEN plan = 'free' AND credits_remaining - 1 <= 0 THEN true ELSE free_converter_used END,
    updated_at = clock_timestamp() WHERE id = v_workspace.id;
  UPDATE public.intentlead_verified_packages SET status = 'VERIFIED', verified_at = clock_timestamp()
    WHERE id = p_package_id;
  INSERT INTO public.intentlead_cost_events
    (workspace_id, event_type, verified_package_id, customer_credit_delta, idempotency_key, metadata)
  VALUES (v_package.workspace_id, 'PACKAGE_VERIFIED', p_package_id, -1, p_idempotency_key,
    jsonb_build_object('policyId', v_policy.id, 'policyVersion', v_policy.version,
      'marketProfileId', v_market.id, 'discoveryBriefId', v_brief.id))
  RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_charge_verified_package(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_charge_verified_package(uuid, uuid, text) TO service_role;

REVOKE ALL ON FUNCTION public.intentlead_tombstone_opportunity(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_tombstone_opportunity(uuid, uuid, text)
  TO service_role;

-- Review hardening: bounded version-1 domain payloads and relational references.
CREATE OR REPLACE FUNCTION public.intentlead_jsonb_keys_allowed(p_value jsonb, p_allowed text[])
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT jsonb_typeof(p_value) = 'object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) AS key WHERE NOT (key = ANY(p_allowed))
    )
$$;

CREATE OR REPLACE FUNCTION public.intentlead_valid_structured_facts(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog
AS $$
DECLARE
  v_item jsonb;
  v_metric text;
BEGIN
  IF NOT public.intentlead_jsonb_keys_allowed(
    p_value, ARRAY['companyName','companyDomain','employeeCount','technologies','location','problem','sourceMeasurement']
  ) THEN RETURN false; END IF;
  IF p_value ? 'companyName' AND (jsonb_typeof(p_value->'companyName') <> 'string' OR btrim(p_value->>'companyName') = '') THEN RETURN false; END IF;
  IF p_value ? 'companyDomain' AND (jsonb_typeof(p_value->'companyDomain') <> 'string' OR p_value->>'companyDomain' !~ '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$') THEN RETURN false; END IF;
  IF p_value ? 'employeeCount' AND (jsonb_typeof(p_value->'employeeCount') <> 'number' OR (p_value->>'employeeCount')::numeric < 0 OR trunc((p_value->>'employeeCount')::numeric) <> (p_value->>'employeeCount')::numeric) THEN RETURN false; END IF;
  IF p_value ? 'technologies' THEN
    IF jsonb_typeof(p_value->'technologies') <> 'array' OR jsonb_array_length(p_value->'technologies') = 0 THEN RETURN false; END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_value->'technologies') LOOP
      IF jsonb_typeof(v_item) <> 'string' OR btrim(v_item #>> '{}') = '' THEN RETURN false; END IF;
    END LOOP;
  END IF;
  IF p_value ? 'location' THEN
    IF NOT public.intentlead_jsonb_keys_allowed(p_value->'location', ARRAY['countryCode','subdivisionCode','locality'])
      OR jsonb_typeof(p_value->'location'->'countryCode') <> 'string'
      OR p_value->'location'->>'countryCode' !~ '^[A-Z]{2}$'
    THEN RETURN false; END IF;
    IF p_value->'location' ? 'subdivisionCode' AND jsonb_typeof(p_value->'location'->'subdivisionCode') NOT IN ('string','null') THEN RETURN false; END IF;
    IF p_value->'location' ? 'locality' AND jsonb_typeof(p_value->'location'->'locality') NOT IN ('string','null') THEN RETURN false; END IF;
  END IF;
  IF p_value ? 'problem' THEN
    IF NOT public.intentlead_jsonb_keys_allowed(p_value->'problem', ARRAY['category','observedCondition'])
      OR NOT (p_value->'problem' ?& ARRAY['category','observedCondition'])
      OR p_value->'problem'->>'category' NOT IN ('website','local_listing','reviews','reputation','acquisition','conversion','operations')
      OR jsonb_typeof(p_value->'problem'->'observedCondition') <> 'string'
      OR btrim(p_value->'problem'->>'observedCondition') = ''
    THEN RETURN false; END IF;
  END IF;
  IF p_value ? 'sourceMeasurement' THEN
    IF NOT public.intentlead_jsonb_keys_allowed(p_value->'sourceMeasurement', ARRAY['metric','value','scaleMax','observedAt'])
      OR NOT (p_value->'sourceMeasurement' ?& ARRAY['metric','value','observedAt'])
      OR jsonb_typeof(p_value->'sourceMeasurement'->'metric') <> 'string'
      OR jsonb_typeof(p_value->'sourceMeasurement'->'value') <> 'number'
      OR jsonb_typeof(p_value->'sourceMeasurement'->'observedAt') <> 'string'
    THEN RETURN false; END IF;
    v_metric := p_value->'sourceMeasurement'->>'metric';
    IF v_metric NOT IN ('REVIEW_COUNT','MENTION_COUNT','CITATION_COUNT','OBSERVATION_COUNT','SEARCH_RANK','HTTP_STATUS','REVIEW_RATING') THEN RETURN false; END IF;
    PERFORM (p_value->'sourceMeasurement'->>'observedAt')::timestamptz;
    IF v_metric = 'REVIEW_RATING' THEN
      IF jsonb_typeof(p_value->'sourceMeasurement'->'scaleMax') <> 'number'
        OR (p_value->'sourceMeasurement'->>'scaleMax')::numeric <= 0
        OR (p_value->'sourceMeasurement'->>'value')::numeric < 0
        OR (p_value->'sourceMeasurement'->>'value')::numeric > (p_value->'sourceMeasurement'->>'scaleMax')::numeric
      THEN RETURN false; END IF;
    ELSIF p_value->'sourceMeasurement' ? 'scaleMax' THEN RETURN false;
    END IF;
  END IF;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_valid_provenance(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog
AS $$
BEGIN
  IF NOT public.intentlead_jsonb_keys_allowed(p_value, ARRAY['sourceType','sourceId','providerRunId','rawArtifactId'])
    OR NOT (p_value ?& ARRAY['sourceType','sourceId','providerRunId','rawArtifactId'])
    OR p_value->>'sourceType' NOT IN ('WEB','SOCIAL','DIRECTORY','DOCUMENT','MEASUREMENT','HUMAN')
    OR jsonb_typeof(p_value->'sourceId') <> 'string' OR btrim(p_value->>'sourceId') = ''
    OR jsonb_typeof(p_value->'providerRunId') NOT IN ('string','null')
    OR jsonb_typeof(p_value->'rawArtifactId') NOT IN ('string','null')
  THEN RETURN false; END IF;
  IF jsonb_typeof(p_value->'providerRunId') = 'string' THEN PERFORM (p_value->>'providerRunId')::uuid; END IF;
  IF jsonb_typeof(p_value->'rawArtifactId') = 'string' THEN PERFORM (p_value->>'rawArtifactId')::uuid; END IF;
  RETURN true;
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_valid_jurisdictions(p_value jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
DECLARE v_item jsonb;
BEGIN
  IF jsonb_typeof(p_value) <> 'array' THEN RETURN false; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_value) LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_item, ARRAY['countryCode','subdivisionCode'])
      OR NOT (v_item ?& ARRAY['countryCode','subdivisionCode'])
      OR jsonb_typeof(v_item->'countryCode') <> 'string'
      OR v_item->>'countryCode' !~ '^[A-Z]{2}$'
      OR jsonb_typeof(v_item->'subdivisionCode') NOT IN ('string','null')
      OR (jsonb_typeof(v_item->'subdivisionCode') = 'string' AND btrim(v_item->>'subdivisionCode') = '')
    THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_valid_signal(p_value jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT public.intentlead_jsonb_keys_allowed(p_value, ARRAY['family','subtype'])
    AND p_value ?& ARRAY['family','subtype']
    AND jsonb_typeof(p_value->'family') = 'string'
    AND jsonb_typeof(p_value->'subtype') = 'string'
    AND CASE p_value->>'family'
      WHEN 'EXPRESSED_INTENT' THEN p_value->>'subtype' IN ('recommendation_request','comparison','switching','complaint','solution_search','rfp')
      WHEN 'TRIGGER_EVENT' THEN p_value->>'subtype' IN ('hiring','funding','launch','expansion','leadership_change','technology_change')
      WHEN 'DETECTED_PROBLEM' THEN p_value->>'subtype' IN ('website','local_listing','reviews','reputation','acquisition','conversion','operations')
      WHEN 'VISIBILITY_FINDING' THEN p_value->>'subtype' IN ('ai_visibility','citation_gap','competitor_overtake','local_visibility')
      ELSE false
    END
$$;

ALTER TABLE public.intentlead_source_items DROP CONSTRAINT intentlead_source_items_check;
ALTER TABLE public.intentlead_source_items
  ADD CONSTRAINT intentlead_source_items_content_check CHECK (
    tombstoned_at IS NOT NULL OR content IS NOT NULL OR normalized_facts <> '{}'::jsonb
  ),
  ADD CONSTRAINT intentlead_source_items_facts_v1_check CHECK (public.intentlead_valid_structured_facts(normalized_facts)),
  ADD CONSTRAINT intentlead_source_items_provenance_v1_check CHECK (public.intentlead_valid_provenance(provenance)),
  ADD CONSTRAINT intentlead_source_items_provider_provenance_check CHECK (
    coalesce(provenance->>'providerRunId','') = coalesce(provider_run_id::text,'')
  );

ALTER TABLE public.intentlead_evidence_items
  ADD COLUMN provider_run_id uuid,
  ADD CONSTRAINT intentlead_evidence_provider_run_fk FOREIGN KEY (workspace_id, provider_run_id)
    REFERENCES public.intentlead_provider_runs(workspace_id, id),
  ADD CONSTRAINT intentlead_evidence_facts_v1_check CHECK (public.intentlead_valid_structured_facts(structured_facts)),
  ADD CONSTRAINT intentlead_evidence_provenance_v1_check CHECK (public.intentlead_valid_provenance(provenance)),
  ADD CONSTRAINT intentlead_evidence_provider_provenance_check CHECK (
    coalesce(provenance->>'providerRunId','') = coalesce(provider_run_id::text,'')
  ),
  ADD CONSTRAINT intentlead_evidence_artifact_provenance_check CHECK (
    coalesce(provenance->>'rawArtifactId','') = coalesce(artifact_id::text,'')
  );
ALTER TABLE public.intentlead_opportunities
  ADD CONSTRAINT intentlead_opportunity_signal_v1_check CHECK (public.intentlead_valid_signal(signal));
ALTER TABLE public.intentlead_opportunities DROP COLUMN market_profile_key;

CREATE UNIQUE INDEX intentlead_campaigns_workspace_id_id_uq ON public.campaigns(workspace_id, id);
ALTER TABLE public.intentlead_discovery_briefs
  DROP CONSTRAINT intentlead_discovery_briefs_legacy_campaign_id_fkey,
  ADD CONSTRAINT intentlead_discovery_brief_campaign_workspace_fk
    FOREIGN KEY (workspace_id, legacy_campaign_id) REFERENCES public.campaigns(workspace_id, id) ON DELETE SET NULL;

ALTER TABLE public.intentlead_market_profiles
  ADD COLUMN capabilities text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN disabled_capabilities text[] NOT NULL DEFAULT '{}'::text[],
  ADD CONSTRAINT intentlead_market_capabilities_known_check CHECK (
    capabilities <@ ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW','PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]
    AND disabled_capabilities <@ ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW','PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]
    AND NOT capabilities && disabled_capabilities
  ),
  ADD CONSTRAINT intentlead_market_discovery_capabilities_check CHECK (
    profile_key <> 'EN_DISCOVERY_ONLY'
    OR NOT capabilities && ARRAY['PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]
  );

ALTER TABLE public.intentlead_opportunity_assessments
  DROP COLUMN assessment,
  DROP COLUMN evidence_ids,
  ADD COLUMN signal jsonb NOT NULL,
  ADD COLUMN problem_type text NOT NULL,
  ADD COLUMN problem_statement text NOT NULL,
  ADD COLUMN evidence_strength numeric NOT NULL CHECK (evidence_strength BETWEEN 0 AND 1),
  ADD COLUMN explicitness numeric NOT NULL CHECK (explicitness BETWEEN 0 AND 1),
  ADD COLUMN urgency numeric NOT NULL CHECK (urgency BETWEEN 0 AND 1),
  ADD COLUMN freshness numeric NOT NULL CHECK (freshness BETWEEN 0 AND 1),
  ADD COLUMN commercial_impact numeric NOT NULL CHECK (commercial_impact BETWEEN 0 AND 1),
  ADD COLUMN icp_fit numeric NOT NULL CHECK (icp_fit BETWEEN 0 AND 1),
  ADD COLUMN company_confidence numeric NOT NULL CHECK (company_confidence BETWEEN 0 AND 1),
  ADD COLUMN buyer_relevance numeric NOT NULL CHECK (buyer_relevance BETWEEN 0 AND 1),
  ADD COLUMN actionability numeric NOT NULL CHECK (actionability BETWEEN 0 AND 1),
  ADD COLUMN confidence numeric NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  ADD COLUMN rejection_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN review_reasons text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN tombstoned_at timestamptz,
  ADD CONSTRAINT intentlead_assessment_signal_v1_check CHECK (public.intentlead_valid_signal(signal)),
  ADD CONSTRAINT intentlead_assessment_decision_reason_check CHECK (
    (decision = 'QUALIFY' AND cardinality(rejection_reasons) = 0 AND cardinality(review_reasons) = 0)
    OR (decision = 'REVIEW' AND cardinality(rejection_reasons) = 0 AND cardinality(review_reasons) > 0)
    OR (decision = 'REJECT' AND cardinality(rejection_reasons) > 0 AND cardinality(review_reasons) = 0)
  ),
  ADD CONSTRAINT intentlead_assessment_problem_check CHECK (
    tombstoned_at IS NOT NULL OR (btrim(problem_type) <> '' AND btrim(problem_statement) <> '')
  );

ALTER TABLE public.intentlead_buyer_candidates DROP COLUMN evidence_ids;
ALTER TABLE public.intentlead_contact_points DROP COLUMN evidence_ids;
ALTER TABLE public.intentlead_contact_verifications DROP COLUMN evidence_ids;

ALTER TABLE public.intentlead_opportunity_evidence
  ADD CONSTRAINT intentlead_opportunity_evidence_workspace_triplet_uq UNIQUE (workspace_id, opportunity_id, evidence_id);

CREATE TABLE public.intentlead_assessment_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (assessment_id, evidence_id),
  FOREIGN KEY (workspace_id, assessment_id) REFERENCES public.intentlead_opportunity_assessments(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, opportunity_id, evidence_id)
    REFERENCES public.intentlead_opportunity_evidence(workspace_id, opportunity_id, evidence_id)
);

CREATE TABLE public.intentlead_buyer_candidate_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  buyer_candidate_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_candidate_id, evidence_id),
  FOREIGN KEY (workspace_id, buyer_candidate_id) REFERENCES public.intentlead_buyer_candidates(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.intentlead_evidence_items(workspace_id, id)
);

CREATE TABLE public.intentlead_contact_point_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_point_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_point_id, evidence_id),
  FOREIGN KEY (workspace_id, contact_point_id) REFERENCES public.intentlead_contact_points(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.intentlead_evidence_items(workspace_id, id)
);

CREATE TABLE public.intentlead_contact_verification_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  contact_verification_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_verification_id, evidence_id),
  FOREIGN KEY (workspace_id, contact_verification_id) REFERENCES public.intentlead_contact_verifications(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.intentlead_evidence_items(workspace_id, id)
);

ALTER TABLE public.intentlead_opportunities ADD COLUMN current_assessment_id uuid;
ALTER TABLE public.intentlead_opportunities
  ADD CONSTRAINT intentlead_opportunity_current_assessment_fk
  FOREIGN KEY (workspace_id, current_assessment_id)
  REFERENCES public.intentlead_opportunity_assessments(workspace_id, id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION public.intentlead_validate_opportunity_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_assessment_opportunity uuid;
  v_market_profile_key text;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NULL; END IF;
  SELECT m.profile_key INTO v_market_profile_key
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m
    ON m.id = b.market_profile_id AND m.workspace_id = b.workspace_id
  WHERE b.id = NEW.discovery_brief_id AND b.workspace_id = NEW.workspace_id;
  IF v_market_profile_key IS NULL THEN RAISE EXCEPTION 'opportunity_market_profile_missing'; END IF;
  IF v_market_profile_key = 'EN_DISCOVERY_ONLY' AND NEW.state NOT IN (
    'DISCOVERED','ENRICHING','ASSESSABLE','INSUFFICIENT_EVIDENCE','PACKAGE_READY',
    'MODEL_REJECTED','HUMAN_REVIEW','REJECTED','NEEDS_RESEARCH'
  ) THEN RAISE EXCEPTION 'discovery_opportunity_state_denied'; END IF;
  IF NEW.state IN ('DISCOVERED','ENRICHING','INSUFFICIENT_EVIDENCE') THEN
    IF NEW.current_assessment_id IS NOT NULL THEN RAISE EXCEPTION 'incomplete_opportunity_has_assessment'; END IF;
  ELSIF NEW.state = 'ASSESSABLE' THEN
    IF NEW.company_id IS NULL OR NEW.current_assessment_id IS NOT NULL THEN RAISE EXCEPTION 'assessable_opportunity_reference_invalid'; END IF;
  ELSIF NEW.company_id IS NULL OR NEW.current_assessment_id IS NULL THEN
    RAISE EXCEPTION 'assessed_opportunity_references_required';
  END IF;
  IF NEW.current_assessment_id IS NOT NULL THEN
    SELECT opportunity_id INTO v_assessment_opportunity
    FROM public.intentlead_opportunity_assessments
    WHERE id = NEW.current_assessment_id AND workspace_id = NEW.workspace_id;
    IF v_assessment_opportunity IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'assessment_opportunity_mismatch'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER intentlead_opportunity_snapshot_valid
  AFTER INSERT OR UPDATE ON public.intentlead_opportunities
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_opportunity_snapshot();

CREATE OR REPLACE FUNCTION public.intentlead_validate_assessment_evidence()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_assessment_id uuid;
  v_opportunity_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'intentlead_opportunity_assessments' THEN v_assessment_id := NEW.id;
  ELSE v_assessment_id := OLD.assessment_id;
  END IF;
  SELECT opportunity_id INTO v_opportunity_id FROM public.intentlead_opportunity_assessments WHERE id = v_assessment_id;
  IF v_opportunity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.intentlead_assessment_evidence
    WHERE assessment_id = v_assessment_id AND opportunity_id = v_opportunity_id
  ) THEN RAISE EXCEPTION 'assessment_requires_opportunity_evidence'; END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER intentlead_assessment_requires_evidence
  AFTER INSERT OR UPDATE ON public.intentlead_opportunity_assessments
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_assessment_evidence();
CREATE CONSTRAINT TRIGGER intentlead_assessment_link_preserves_evidence
  AFTER DELETE OR UPDATE ON public.intentlead_assessment_evidence
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_assessment_evidence();

CREATE TABLE public.intentlead_outreach_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  body text NOT NULL CHECK (btrim(body) <> ''),
  status text NOT NULL CHECK (status IN ('DRAFT','GROUNDED')),
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  UNIQUE (opportunity_id, version),
  FOREIGN KEY (workspace_id, opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id, id)
);
CREATE TABLE public.intentlead_outreach_draft_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  draft_id uuid NOT NULL,
  claim_text text NOT NULL CHECK (btrim(claim_text) <> ''),
  evidence_id uuid NOT NULL,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, draft_id) REFERENCES public.intentlead_outreach_drafts(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.intentlead_evidence_items(workspace_id, id)
);
CREATE TABLE public.intentlead_suppression_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK (schema_version = 1),
  opportunity_id uuid NOT NULL,
  contact_point_id uuid,
  decision text NOT NULL CHECK (decision IN ('CLEAR','BLOCKED')),
  evaluated_at timestamptz NOT NULL,
  tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, id),
  FOREIGN KEY (workspace_id, opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id, id),
  FOREIGN KEY (workspace_id, contact_point_id) REFERENCES public.intentlead_contact_points(workspace_id, id)
);

ALTER TABLE public.intentlead_verification_policies
  DROP COLUMN checks,
  ADD COLUMN jurisdictions jsonb NOT NULL,
  ADD COLUMN evidence_min_items integer NOT NULL CHECK (evidence_min_items > 0),
  ADD COLUMN evidence_min_strength numeric NOT NULL CHECK (evidence_min_strength BETWEEN 0 AND 1),
  ADD COLUMN evidence_max_age_days numeric NOT NULL CHECK (evidence_max_age_days > 0),
  ADD COLUMN company_min_confidence numeric NOT NULL CHECK (company_min_confidence BETWEEN 0 AND 1),
  ADD COLUMN buyer_min_confidence numeric NOT NULL CHECK (buyer_min_confidence BETWEEN 0 AND 1),
  ADD COLUMN buyer_min_relevance numeric NOT NULL CHECK (buyer_min_relevance BETWEEN 0 AND 1),
  ADD COLUMN contact_accepted_statuses text[] NOT NULL,
  ADD COLUMN contact_max_age_days numeric NOT NULL CHECK (contact_max_age_days > 0),
  ADD COLUMN grounded_draft_require_evidence boolean NOT NULL CHECK (grounded_draft_require_evidence),
  ADD COLUMN suppression_must_be_clear boolean NOT NULL CHECK (suppression_must_be_clear),
  ADD COLUMN market_required_capabilities text[] NOT NULL,
  ADD CONSTRAINT intentlead_policy_jurisdictions_check CHECK (
    public.intentlead_valid_jurisdictions(jurisdictions)
    AND (NOT package_verified_allowed OR jsonb_array_length(jurisdictions) > 0)
  ),
  ADD CONSTRAINT intentlead_policy_contact_status_check CHECK (
    cardinality(contact_accepted_statuses) > 0 AND contact_accepted_statuses <@ ARRAY['VALID']::text[]
  ),
  ADD CONSTRAINT intentlead_policy_capabilities_check CHECK (
    ARRAY['PACKAGE_VERIFIED','CONTACT_ENRICHMENT','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY']::text[]
      <@ market_required_capabilities
    AND market_required_capabilities <@ ARRAY['SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW','PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[]
  );

ALTER TABLE public.intentlead_verified_packages
  DROP COLUMN market_profile_key,
  DROP COLUMN workflow,
  ADD COLUMN tombstoned_at timestamptz;

ALTER TABLE public.intentlead_package_check_results
  DROP COLUMN reference_ids,
  ADD COLUMN company_id uuid,
  ADD COLUMN buyer_candidate_id uuid,
  ADD COLUMN contact_verification_id uuid,
  ADD COLUMN outreach_draft_id uuid,
  ADD COLUMN suppression_decision_id uuid,
  ADD COLUMN market_profile_id uuid,
  ADD COLUMN tombstoned_at timestamptz,
  ADD CONSTRAINT intentlead_check_company_fk FOREIGN KEY (workspace_id, company_id)
    REFERENCES public.intentlead_companies(workspace_id, id),
  ADD CONSTRAINT intentlead_check_buyer_fk FOREIGN KEY (workspace_id, buyer_candidate_id)
    REFERENCES public.intentlead_buyer_candidates(workspace_id, id),
  ADD CONSTRAINT intentlead_check_contact_verification_fk FOREIGN KEY (workspace_id, contact_verification_id)
    REFERENCES public.intentlead_contact_verifications(workspace_id, id),
  ADD CONSTRAINT intentlead_check_draft_fk FOREIGN KEY (workspace_id, outreach_draft_id)
    REFERENCES public.intentlead_outreach_drafts(workspace_id, id),
  ADD CONSTRAINT intentlead_check_suppression_decision_fk FOREIGN KEY (workspace_id, suppression_decision_id)
    REFERENCES public.intentlead_suppression_decisions(workspace_id, id),
  ADD CONSTRAINT intentlead_check_market_profile_fk FOREIGN KEY (workspace_id, market_profile_id)
    REFERENCES public.intentlead_market_profiles(workspace_id, id),
  ADD CONSTRAINT intentlead_check_typed_reference_check CHECK (
    (check_name = 'evidence' AND company_id IS NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NULL AND market_profile_id IS NULL)
    OR (check_name = 'company' AND company_id IS NOT NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NULL AND market_profile_id IS NULL)
    OR (check_name = 'buyer' AND company_id IS NULL AND buyer_candidate_id IS NOT NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NULL AND market_profile_id IS NULL)
    OR (check_name = 'contact' AND company_id IS NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NOT NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NULL AND market_profile_id IS NULL)
    OR (check_name = 'grounded_draft' AND company_id IS NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NOT NULL AND suppression_decision_id IS NULL AND market_profile_id IS NULL)
    OR (check_name = 'suppression' AND company_id IS NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NOT NULL AND market_profile_id IS NULL)
    OR (check_name = 'market_workflow' AND company_id IS NULL AND buyer_candidate_id IS NULL AND contact_verification_id IS NULL AND outreach_draft_id IS NULL AND suppression_decision_id IS NULL AND market_profile_id IS NOT NULL)
  );

CREATE TABLE public.intentlead_package_check_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  package_check_id uuid NOT NULL,
  evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (package_check_id, evidence_id),
  FOREIGN KEY (workspace_id, package_check_id) REFERENCES public.intentlead_package_check_results(workspace_id, id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id, evidence_id) REFERENCES public.intentlead_evidence_items(workspace_id, id)
);

ALTER TABLE public.intentlead_opportunity_evidence ADD COLUMN tombstoned_at timestamptz;
ALTER TABLE public.intentlead_contact_verifications ADD COLUMN tombstoned_at timestamptz;
ALTER TABLE public.intentlead_human_reviews ADD COLUMN tombstoned_at timestamptz;
ALTER TABLE public.intentlead_outcomes ADD COLUMN tombstoned_at timestamptz;

CREATE OR REPLACE FUNCTION public.intentlead_validate_evidence_artifact_source()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_artifact_source uuid;
BEGIN
  IF NEW.artifact_id IS NOT NULL THEN
    SELECT source_item_id INTO v_artifact_source
    FROM public.intentlead_artifact_metadata
    WHERE id = NEW.artifact_id AND workspace_id = NEW.workspace_id;
    IF NEW.source_item_id IS NOT NULL AND v_artifact_source IS DISTINCT FROM NEW.source_item_id THEN
      RAISE EXCEPTION 'artifact_source_mismatch';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER intentlead_evidence_artifact_source_valid
  BEFORE INSERT OR UPDATE ON public.intentlead_evidence_items
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_evidence_artifact_source();

-- A tombstone mutation is allowed only while executing a trusted owner function
-- as the table owner on behalf of service_role. Callers cannot set a reusable flag.
CREATE OR REPLACE FUNCTION public.intentlead_reject_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF current_user = pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid = TG_RELID))
    AND (session_user = 'service_role' OR current_setting('role', true) = 'service_role')
  THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'intentlead_append_only:%', TG_TABLE_NAME USING ERRCODE = '55000';
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_assessment_evidence', 'intentlead_buyer_candidate_evidence',
    'intentlead_contact_point_evidence', 'intentlead_contact_verification_evidence',
    'intentlead_outreach_drafts', 'intentlead_outreach_draft_claims',
    'intentlead_suppression_decisions', 'intentlead_package_check_evidence'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format(
      'CREATE POLICY intentlead_workspace_read ON public.%I FOR SELECT TO authenticated USING (public.intentlead_is_workspace_member(workspace_id))',
      v_table
    );
  END LOOP;
END $$;

ALTER TABLE public.intentlead_opportunity_assessments
  DROP CONSTRAINT intentlead_assessment_decision_reason_check,
  ADD CONSTRAINT intentlead_assessment_decision_reason_check CHECK (
    tombstoned_at IS NOT NULL
    OR (decision = 'QUALIFY' AND cardinality(rejection_reasons) = 0 AND cardinality(review_reasons) = 0)
    OR (decision = 'REVIEW' AND cardinality(rejection_reasons) = 0 AND cardinality(review_reasons) > 0)
    OR (decision = 'REJECT' AND cardinality(rejection_reasons) > 0 AND cardinality(review_reasons) = 0)
  );

CREATE OR REPLACE FUNCTION public.intentlead_tombstone_opportunity(
  p_opportunity_id uuid,
  p_user_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN RAISE EXCEPTION 'invalid_tombstone_reason'; END IF;
  SELECT o.workspace_id INTO v_workspace_id
  FROM public.intentlead_opportunities o
  JOIN public.workspaces w ON w.id = o.workspace_id
  WHERE o.id = p_opportunity_id AND w.owner_id = p_user_id
  FOR UPDATE OF o, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.intentlead_opportunities
    SET tombstoned_at = coalesce(tombstoned_at, clock_timestamp()), state = 'CLOSED'
    WHERE id = p_opportunity_id;
  UPDATE public.intentlead_opportunity_evidence
    SET tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;

  UPDATE public.intentlead_evidence_items e
    SET excerpt = NULL, structured_facts = '{}'::jsonb,
        tombstoned_at = coalesce(e.tombstoned_at, clock_timestamp())
    WHERE e.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_opportunity_evidence own_link
        WHERE own_link.opportunity_id = p_opportunity_id AND own_link.evidence_id = e.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.intentlead_opportunity_evidence live_link
        JOIN public.intentlead_opportunities live_op ON live_op.id = live_link.opportunity_id
        WHERE live_link.evidence_id = e.id AND live_link.tombstoned_at IS NULL
          AND live_op.tombstoned_at IS NULL
      );

  UPDATE public.intentlead_source_items s
    SET content = NULL, normalized_facts = '{}'::jsonb,
        tombstoned_at = coalesce(s.tombstoned_at, clock_timestamp())
    WHERE s.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items e
        JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id = e.id
        WHERE oe.opportunity_id = p_opportunity_id AND e.source_item_id = s.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items live_e
        WHERE live_e.source_item_id = s.id AND live_e.tombstoned_at IS NULL
      );
  UPDATE public.intentlead_artifact_metadata a
    SET storage_reference = 'deleted://tombstone', size_bytes = 0,
        tombstoned_at = coalesce(a.tombstoned_at, clock_timestamp())
    WHERE a.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items e
        JOIN public.intentlead_opportunity_evidence oe ON oe.evidence_id = e.id
        WHERE oe.opportunity_id = p_opportunity_id AND e.artifact_id = a.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.intentlead_evidence_items live_e
        WHERE live_e.artifact_id = a.id AND live_e.tombstoned_at IS NULL
      );

  UPDATE public.intentlead_opportunity_assessments
    SET problem_statement = '[deleted]', rejection_reasons = '{}'::text[],
        review_reasons = '{}'::text[], tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_buyer_candidates
    SET hypothesis = '[deleted]', tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_people p
    SET full_name = '[deleted]', role_title = NULL,
        tombstoned_at = coalesce(p.tombstoned_at, clock_timestamp())
    WHERE p.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_buyer_candidates b
        WHERE b.opportunity_id = p_opportunity_id AND b.person_id = p.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.intentlead_buyer_candidates other_b
        JOIN public.intentlead_opportunities other_o ON other_o.id = other_b.opportunity_id
        WHERE other_b.person_id = p.id AND other_o.tombstoned_at IS NULL
      );

  UPDATE public.intentlead_contact_verifications cv
    SET tombstoned_at = coalesce(cv.tombstoned_at, clock_timestamp())
    WHERE EXISTS (
      SELECT 1 FROM public.intentlead_package_check_results r
      JOIN public.intentlead_verified_packages p ON p.id = r.package_id
      WHERE p.opportunity_id = p_opportunity_id AND r.contact_verification_id = cv.id
    );
  UPDATE public.intentlead_contact_points cp
    SET value = NULL, tombstoned_at = coalesce(cp.tombstoned_at, clock_timestamp())
    WHERE cp.workspace_id = v_workspace_id
      AND EXISTS (
        SELECT 1 FROM public.intentlead_contact_verifications cv
        JOIN public.intentlead_package_check_results r ON r.contact_verification_id = cv.id
        JOIN public.intentlead_verified_packages p ON p.id = r.package_id
        WHERE p.opportunity_id = p_opportunity_id AND cv.contact_point_id = cp.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.intentlead_contact_verifications cv
        JOIN public.intentlead_package_check_results r ON r.contact_verification_id = cv.id
        JOIN public.intentlead_verified_packages p ON p.id = r.package_id
        JOIN public.intentlead_opportunities o ON o.id = p.opportunity_id
        WHERE cv.contact_point_id = cp.id AND o.tombstoned_at IS NULL
      );

  UPDATE public.intentlead_human_reviews SET note = NULL,
    tombstoned_at = coalesce(tombstoned_at, clock_timestamp()) WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_outcomes SET details = '{}'::jsonb,
    tombstoned_at = coalesce(tombstoned_at, clock_timestamp()) WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_outreach_drafts SET body = '[deleted]',
    tombstoned_at = coalesce(tombstoned_at, clock_timestamp()) WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_outreach_draft_claims c SET claim_text = '[deleted]',
    tombstoned_at = coalesce(c.tombstoned_at, clock_timestamp())
    WHERE EXISTS (SELECT 1 FROM public.intentlead_outreach_drafts d WHERE d.id = c.draft_id AND d.opportunity_id = p_opportunity_id);
  UPDATE public.intentlead_suppression_decisions SET tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;
  UPDATE public.intentlead_package_check_results r SET reason = '[redacted]',
    tombstoned_at = coalesce(r.tombstoned_at, clock_timestamp())
    WHERE EXISTS (SELECT 1 FROM public.intentlead_verified_packages p WHERE p.id = r.package_id AND p.opportunity_id = p_opportunity_id);
  UPDATE public.intentlead_verified_packages SET tombstoned_at = coalesce(tombstoned_at, clock_timestamp())
    WHERE opportunity_id = p_opportunity_id;

  INSERT INTO public.intentlead_deletion_tombstones
    (workspace_id, resource_type, resource_id, reason, requested_by)
  VALUES (v_workspace_id, 'OPPORTUNITY', p_opportunity_id, p_reason, p_user_id)
  ON CONFLICT (workspace_id, resource_type, resource_id) DO NOTHING;
  RETURN true;
END;
$$;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_offer_profiles', 'intentlead_icp_definitions', 'intentlead_market_profiles',
    'intentlead_discovery_briefs', 'intentlead_provider_runs', 'intentlead_source_items',
    'intentlead_companies', 'intentlead_people', 'intentlead_artifact_metadata',
    'intentlead_evidence_items', 'intentlead_opportunities', 'intentlead_opportunity_evidence',
    'intentlead_opportunity_assessments', 'intentlead_assessment_evidence',
    'intentlead_buyer_candidates', 'intentlead_buyer_candidate_evidence',
    'intentlead_contact_points', 'intentlead_contact_point_evidence',
    'intentlead_contact_verifications', 'intentlead_contact_verification_evidence',
    'intentlead_verification_policies', 'intentlead_verified_packages',
    'intentlead_package_check_results', 'intentlead_package_check_evidence',
    'intentlead_suppression_entries', 'intentlead_suppression_decisions',
    'intentlead_human_reviews', 'intentlead_outcomes', 'intentlead_cost_events',
    'intentlead_deletion_tombstones', 'intentlead_outreach_drafts', 'intentlead_outreach_draft_claims'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated, service_role', v_table);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated, service_role', v_table);
  END LOOP;

  FOREACH v_table IN ARRAY ARRAY['intentlead_offer_profiles','intentlead_icp_definitions','intentlead_market_profiles'] LOOP
    EXECUTE format('GRANT INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
  END LOOP;
  GRANT INSERT ON TABLE public.intentlead_human_reviews TO authenticated;
END $$;

-- No direct service mutation of audit, charging or exceptional deletion state.
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON ALL TABLES IN SCHEMA public FROM service_role;
-- Restore only legacy/server operations needed outside the new namespace.
GRANT ALL ON TABLE public.workspaces, public.workspace_members, public.campaigns,
  public.signals, public.leads, public.messages, public.client_context_chunks,
  public.conversations, public.conversation_messages TO service_role;

DO $$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'intentlead_assessment_evidence', 'intentlead_buyer_candidate_evidence',
    'intentlead_contact_point_evidence', 'intentlead_contact_verification_evidence',
    'intentlead_outreach_drafts', 'intentlead_outreach_draft_claims',
    'intentlead_suppression_decisions', 'intentlead_package_check_evidence'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER intentlead_append_only BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.intentlead_reject_audit_mutation()',
      v_table
    );
  END LOOP;
END $$;
