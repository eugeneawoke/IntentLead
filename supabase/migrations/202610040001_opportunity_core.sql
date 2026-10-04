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
  IF current_setting('intentlead.tombstone', true) = 'on' THEN
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

  PERFORM set_config('intentlead.tombstone', 'on', true);
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

REVOKE ALL ON FUNCTION public.intentlead_tombstone_opportunity(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_tombstone_opportunity(uuid, uuid, text)
  TO service_role;

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
  v_event_id uuid;
  v_check_count integer;
  v_pass_count integer;
BEGIN
  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' THEN
    RAISE EXCEPTION 'invalid_idempotency_key';
  END IF;

  SELECT p.* INTO v_package
  FROM public.intentlead_verified_packages p
  JOIN public.workspaces w ON w.id = p.workspace_id
  WHERE p.id = p_package_id AND w.owner_id = p_user_id
  FOR UPDATE OF p, w;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_workspace FROM public.workspaces
    WHERE id = v_package.workspace_id FOR UPDATE;

  SELECT id INTO v_event_id FROM public.intentlead_cost_events
  WHERE workspace_id = v_package.workspace_id
    AND event_type = 'PACKAGE_VERIFIED'
    AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.intentlead_cost_events
      WHERE id = v_event_id AND verified_package_id = p_package_id
    ) THEN RAISE EXCEPTION 'idempotency_conflict'; END IF;
    RETURN v_event_id;
  END IF;

  IF v_package.status = 'VERIFIED' THEN
    RAISE EXCEPTION 'package_already_charged';
  ELSIF v_package.status <> 'PENDING' THEN
    RAISE EXCEPTION 'package_not_chargeable';
  END IF;

  SELECT * INTO v_policy FROM public.intentlead_verification_policies
  WHERE id = v_package.policy_id AND workspace_id = v_package.workspace_id
    AND version = v_package.policy_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'verification_policy_not_found'; END IF;
  IF NOT v_policy.package_verified_allowed
    OR v_policy.workflow <> 'ASSISTED_OUTREACH'
    OR v_policy.market_profile_key = 'EN_DISCOVERY_ONLY'
    OR v_package.workflow <> v_policy.workflow
    OR v_package.market_profile_key <> v_policy.market_profile_key
  THEN RAISE EXCEPTION 'package_verification_disabled'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.intentlead_opportunities
    WHERE id = v_package.opportunity_id AND workspace_id = v_package.workspace_id
      AND market_profile_key = v_package.market_profile_key
      AND state IN ('PACKAGE_READY', 'HUMAN_REVIEW', 'OUTREACH_READY')
  ) THEN RAISE EXCEPTION 'package_not_chargeable'; END IF;

  SELECT count(*), count(*) FILTER (WHERE status = 'PASS')
    INTO v_check_count, v_pass_count
  FROM public.intentlead_package_check_results
  WHERE package_id = p_package_id AND workspace_id = v_package.workspace_id;
  IF v_check_count <> 7 THEN RAISE EXCEPTION 'verification_checks_incomplete'; END IF;
  IF v_pass_count <> 7 THEN RAISE EXCEPTION 'verification_checks_failed'; END IF;
  IF v_workspace.credits_remaining <= 0
    OR (v_workspace.plan = 'free' AND v_workspace.free_converter_used)
  THEN RAISE EXCEPTION 'insufficient_credits'; END IF;

  UPDATE public.workspaces
    SET credits_remaining = credits_remaining - 1,
        free_converter_used = CASE
          WHEN plan = 'free' AND credits_remaining - 1 <= 0 THEN true
          ELSE free_converter_used
        END,
        updated_at = clock_timestamp()
    WHERE id = v_workspace.id;
  UPDATE public.intentlead_verified_packages
    SET status = 'VERIFIED', verified_at = clock_timestamp()
    WHERE id = p_package_id;
  INSERT INTO public.intentlead_cost_events
    (workspace_id, event_type, verified_package_id, customer_credit_delta, idempotency_key, metadata)
  VALUES (
    v_package.workspace_id, 'PACKAGE_VERIFIED', p_package_id, -1, p_idempotency_key,
    jsonb_build_object('policyId', v_policy.id, 'policyVersion', v_policy.version)
  ) RETURNING id INTO v_event_id;
  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_charge_verified_package(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_charge_verified_package(uuid, uuid, text)
  TO service_role;
