-- Task I: contact-ready Opportunity package storage. Forward-only after Task E.
-- This restores no campaign, lead, mailbox, message, sequence, billing or sending object.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.intentlead_normalize_market_profile_capabilities()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  v_research text[]:=ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
    'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
  ]::text[];
  v_transmission text[]:=ARRAY['MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING']::text[];
BEGIN
  IF NEW.capabilities && v_transmission THEN RAISE EXCEPTION 'transmission_capability_denied'; END IF;
  NEW.disabled_capabilities:=ARRAY(SELECT DISTINCT value FROM unnest(NEW.disabled_capabilities||v_transmission) value ORDER BY value);
  IF NEW.profile_key='EN_DISCOVERY_ONLY' THEN
    NEW.capabilities:=ARRAY(SELECT DISTINCT value FROM unnest(NEW.capabilities||v_research) value ORDER BY value);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_normalize_market_profile_capabilities() FROM PUBLIC,anon,authenticated,service_role;

ALTER TABLE public.intentlead_market_profiles
  DROP CONSTRAINT IF EXISTS intentlead_market_capabilities_known_check;
UPDATE public.intentlead_market_profiles SET
  capabilities=ARRAY(SELECT value FROM unnest(capabilities) value WHERE value<>ALL(ARRAY[
    'MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING'
  ]::text[]) ORDER BY value),
  disabled_capabilities=ARRAY(SELECT DISTINCT value FROM unnest(disabled_capabilities||ARRAY[
    'MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING'
  ]::text[]) value ORDER BY value);
UPDATE public.intentlead_market_profiles SET
  capabilities=ARRAY(SELECT DISTINCT value FROM unnest(capabilities||ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
    'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
  ]::text[]) value ORDER BY value)
WHERE profile_key='EN_DISCOVERY_ONLY';
ALTER TABLE public.intentlead_market_profiles ADD CONSTRAINT intentlead_market_capabilities_known_check CHECK (
  capabilities <@ ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
    'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT',
    'MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING'
  ]::text[]
  AND disabled_capabilities <@ ARRAY[
    'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
    'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT',
    'MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING'
  ]::text[]
  AND NOT capabilities && disabled_capabilities
  AND NOT capabilities && ARRAY['MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING']::text[]
  AND disabled_capabilities @> ARRAY['MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING']::text[]
  AND (profile_key<>'EN_DISCOVERY_ONLY' OR (
    capabilities <@ ARRAY[
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
      'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
    ]::text[]
    AND capabilities @> ARRAY[
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
      'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
    ]::text[]
    AND disabled_capabilities @> ARRAY[
      'MAILBOX_CONNECT','MESSAGE_SEND','SEQUENCE_RUN','FOLLOW_UP','DELIVERY_TRACKING'
    ]::text[]
  ))
);
DROP TRIGGER IF EXISTS intentlead_market_profile_capability_boundary ON public.intentlead_market_profiles;
CREATE TRIGGER intentlead_market_profile_capability_boundary
  BEFORE INSERT OR UPDATE OF profile_key,capabilities,disabled_capabilities ON public.intentlead_market_profiles
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_normalize_market_profile_capabilities();

ALTER TABLE public.intentlead_jobs DROP CONSTRAINT IF EXISTS intentlead_jobs_capability_check;
ALTER TABLE public.intentlead_jobs ADD CONSTRAINT intentlead_jobs_capability_check CHECK (capability IN (
  'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
  'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
));

CREATE OR REPLACE FUNCTION public.intentlead_valid_capability_error(p_value jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = pg_catalog AS $$
  SELECT jsonb_typeof(p_value)='object'
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_value) key
      WHERE key<>ALL(ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs'])
    )
    AND p_value ?& ARRAY['schemaVersion','message','capability','traceId','retryable','code','retryAfterMs']
    AND p_value->>'schemaVersion'='1'
    AND jsonb_typeof(p_value->'message')='string' AND btrim(p_value->>'message')<>''
    AND p_value->>'capability' IN (
      'SOURCE_SEARCH','WEB_FETCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','PERSON_SEARCH',
      'EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','HUMAN_REVIEW','COPY_EXPORT'
    )
    AND jsonb_typeof(p_value->'traceId')='string' AND btrim(p_value->>'traceId')<>''
    AND jsonb_typeof(p_value->'retryable')='boolean'
    AND (
      (p_value->>'retryable'='true'
        AND p_value->>'code' IN ('RATE_LIMITED','TIMEOUT','DEPENDENCY_UNAVAILABLE')
        AND jsonb_typeof(p_value->'retryAfterMs') IN ('number','null')
        AND (jsonb_typeof(p_value->'retryAfterMs')='null' OR (p_value->>'retryAfterMs')::numeric>=0))
      OR (p_value->>'retryable'='false'
        AND p_value->>'code' IN ('INVALID_INPUT','UNAUTHENTICATED','FORBIDDEN','NOT_FOUND','POLICY_DENIED',
          'CAPABILITY_UNAVAILABLE','BUDGET_EXCEEDED','CONFLICT','INTERNAL_ERROR')
        AND jsonb_typeof(p_value->'retryAfterMs')='null')
    )
$$;

ALTER TABLE public.intentlead_jobs DROP CONSTRAINT IF EXISTS intentlead_jobs_error_capability_match;
ALTER TABLE public.intentlead_jobs ADD CONSTRAINT intentlead_jobs_error_capability_match CHECK (
  error IS NULL OR error->>'capability'=capability
);

CREATE TABLE public.intentlead_suppression_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), identifier_type text NOT NULL CHECK(identifier_type IN ('EMAIL','PHONE','PROFILE')),
  identifier_hash text NOT NULL CHECK(identifier_hash~'^[0-9a-f]{64}$'), reason text NOT NULL CHECK(reason IN ('OPT_OUT','COMPLAINT','POLICY')),
  policy_id text NOT NULL CHECK(btrim(policy_id)<>''), source text NOT NULL CHECK(source IN ('HUMAN','POLICY','PROVIDER')),
  retain_until timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), UNIQUE(workspace_id,identifier_type,identifier_hash),
  CHECK(retain_until IS NULL OR retain_until>=created_at)
);

CREATE TABLE public.intentlead_people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, company_id uuid NOT NULL,
  full_name text NOT NULL CHECK(btrim(full_name)<>''), role_title text, jurisdiction jsonb CHECK(jurisdiction IS NULL OR jsonb_typeof(jurisdiction)='object'),
  confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1), idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'),
  resolved_at timestamptz NOT NULL, tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,opportunity_id,idempotency_key),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,company_id) REFERENCES public.intentlead_companies(workspace_id,id)
);
CREATE TABLE public.intentlead_person_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, person_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(person_id,evidence_id),
  FOREIGN KEY(workspace_id,person_id,opportunity_id) REFERENCES public.intentlead_people(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

CREATE TABLE public.intentlead_buyer_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, company_id uuid NOT NULL, person_id uuid,
  role_title text NOT NULL CHECK(btrim(role_title)<>''), hypothesis text NOT NULL CHECK(btrim(hypothesis)<>''), confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  relevance numeric NOT NULL CHECK(relevance BETWEEN 0 AND 1), rank integer NOT NULL CHECK(rank>0), idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'),
  tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,opportunity_id,idempotency_key), UNIQUE(opportunity_id,rank),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,company_id) REFERENCES public.intentlead_companies(workspace_id,id),
  FOREIGN KEY(workspace_id,person_id,opportunity_id) REFERENCES public.intentlead_people(workspace_id,id,opportunity_id)
);
CREATE TABLE public.intentlead_buyer_candidate_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, buyer_candidate_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(buyer_candidate_id,evidence_id),
  FOREIGN KEY(workspace_id,buyer_candidate_id,opportunity_id) REFERENCES public.intentlead_buyer_candidates(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

CREATE TABLE public.intentlead_contact_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, person_id uuid, company_id uuid NOT NULL,
  channel text NOT NULL CHECK(channel IN ('email','profile','phone')), scope text NOT NULL CHECK(scope IN ('PERSON','COMPANY')),
  state text NOT NULL DEFAULT 'AVAILABLE' CHECK(state IN ('AVAILABLE','SUPPRESSED','DELETED')),
  value text, value_hash text NOT NULL CHECK(value_hash~'^[0-9a-f]{64}$'), source_kind text NOT NULL CHECK(source_kind IN ('PUBLIC_WEB','AUTHORIZED_PROVIDER','USER_PROVIDED')),
  source_url text, source_provider_run_id uuid, jurisdiction jsonb NOT NULL CHECK(jsonb_typeof(jurisdiction)='object'), suppression_entry_id uuid,
  market_policy_id text NOT NULL CHECK(btrim(market_policy_id)<>''), resolution_confidence numeric NOT NULL CHECK(resolution_confidence BETWEEN 0 AND 1),
  idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'), captured_at timestamptz NOT NULL,
  tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,opportunity_id,idempotency_key), UNIQUE(workspace_id,opportunity_id,channel,value_hash),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,person_id,opportunity_id) REFERENCES public.intentlead_people(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,company_id) REFERENCES public.intentlead_companies(workspace_id,id),
  FOREIGN KEY(workspace_id,source_provider_run_id) REFERENCES public.intentlead_provider_runs(workspace_id,id),
  FOREIGN KEY(workspace_id,suppression_entry_id) REFERENCES public.intentlead_suppression_entries(workspace_id,id),
  CHECK((state='AVAILABLE' AND value IS NOT NULL AND suppression_entry_id IS NULL) OR (state='SUPPRESSED' AND value IS NULL AND suppression_entry_id IS NOT NULL) OR (state='DELETED' AND value IS NULL AND suppression_entry_id IS NULL)),
  CHECK((scope='PERSON' AND person_id IS NOT NULL) OR (scope='COMPANY' AND person_id IS NULL)),
  CHECK((source_kind='PUBLIC_WEB' AND source_url~*'^https?://' AND source_provider_run_id IS NULL) OR (source_kind='AUTHORIZED_PROVIDER' AND source_provider_run_id IS NOT NULL AND (source_url IS NULL OR source_url~*'^https?://')) OR (source_kind='USER_PROVIDED' AND source_provider_run_id IS NULL AND (source_url IS NULL OR source_url~*'^https?://')))
);
CREATE TABLE public.intentlead_contact_point_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, contact_point_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(contact_point_id,evidence_id),
  FOREIGN KEY(workspace_id,contact_point_id,opportunity_id) REFERENCES public.intentlead_contact_points(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

CREATE TABLE public.intentlead_contact_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, contact_point_id uuid NOT NULL,
  status text NOT NULL CHECK(status IN ('VALID','INVALID','RISKY','UNKNOWN')), method text NOT NULL CHECK(method IN ('PUBLIC_SOURCE','PROVIDER','USER_CONFIRMED','SYNTAX_ONLY')),
  provider_run_id uuid, confidence numeric NOT NULL CHECK(confidence BETWEEN 0 AND 1), checked_at timestamptz NOT NULL, expires_at timestamptz,
  idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'), tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,id,opportunity_id,contact_point_id), UNIQUE(workspace_id,opportunity_id,idempotency_key),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,contact_point_id,opportunity_id) REFERENCES public.intentlead_contact_points(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,provider_run_id) REFERENCES public.intentlead_provider_runs(workspace_id,id),
  CHECK((method='PROVIDER')=(provider_run_id IS NOT NULL)), CHECK(NOT(method='SYNTAX_ONLY' AND status='VALID')),
  CHECK(status<>'VALID' OR expires_at IS NOT NULL),
  CHECK(expires_at IS NULL OR expires_at>=checked_at)
);
CREATE INDEX intentlead_contact_verifications_latest_idx ON public.intentlead_contact_verifications(contact_point_id,checked_at DESC) WHERE tombstoned_at IS NULL;
CREATE TABLE public.intentlead_contact_verification_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, contact_verification_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(contact_verification_id,evidence_id),
  FOREIGN KEY(workspace_id,contact_verification_id,opportunity_id) REFERENCES public.intentlead_contact_verifications(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

CREATE TABLE public.intentlead_conversation_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, buyer_candidate_id uuid NOT NULL,
  contact_point_id uuid NOT NULL, contact_verification_id uuid NOT NULL,
  problem_summary text NOT NULL CHECK(btrim(problem_summary)<>''), relevance_summary text NOT NULL CHECK(btrim(relevance_summary)<>''),
  recommended_angle text NOT NULL CHECK(btrim(recommended_angle)<>''), low_friction_cta text NOT NULL CHECK(btrim(low_friction_cta)<>''),
  idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'), tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,opportunity_id,idempotency_key),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,buyer_candidate_id,opportunity_id) REFERENCES public.intentlead_buyer_candidates(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,contact_point_id,opportunity_id) REFERENCES public.intentlead_contact_points(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,contact_verification_id,opportunity_id,contact_point_id) REFERENCES public.intentlead_contact_verifications(workspace_id,id,opportunity_id,contact_point_id)
);
CREATE TABLE public.intentlead_conversation_brief_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, brief_id uuid NOT NULL, opportunity_id uuid NOT NULL,
  claim_text text NOT NULL CHECK(btrim(claim_text)<>''), tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,brief_id,opportunity_id) REFERENCES public.intentlead_conversation_briefs(workspace_id,id,opportunity_id) ON DELETE CASCADE
);
CREATE TABLE public.intentlead_conversation_brief_claim_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, claim_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(claim_id,evidence_id),
  FOREIGN KEY(workspace_id,claim_id,opportunity_id) REFERENCES public.intentlead_conversation_brief_claims(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

CREATE TABLE public.intentlead_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  schema_version integer NOT NULL DEFAULT 1 CHECK(schema_version=1), opportunity_id uuid NOT NULL, conversation_brief_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
  channel text NOT NULL CHECK(channel IN ('EMAIL','LINKEDIN_DM','GENERIC_MESSAGE')), delivery_mode text NOT NULL DEFAULT 'COPY_EXPORT_ONLY' CHECK(delivery_mode='COPY_EXPORT_ONLY'),
  subject text, body text NOT NULL CHECK(btrim(body)<>''), status text NOT NULL CHECK(status IN ('DRAFT','GROUNDED')),
  idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{12,128}$'), tombstoned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace_id,id),
  UNIQUE(workspace_id,id,opportunity_id), UNIQUE(workspace_id,opportunity_id,idempotency_key), UNIQUE(conversation_brief_id,version),
  FOREIGN KEY(workspace_id,opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id),
  FOREIGN KEY(workspace_id,conversation_brief_id,opportunity_id) REFERENCES public.intentlead_conversation_briefs(workspace_id,id,opportunity_id)
);
CREATE TABLE public.intentlead_draft_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, draft_id uuid NOT NULL, opportunity_id uuid NOT NULL,
  target text NOT NULL CHECK(target IN ('SUBJECT','BODY')), start_offset integer NOT NULL CHECK(start_offset>=0), end_offset integer NOT NULL CHECK(end_offset>start_offset),
  claim_text text NOT NULL CHECK(btrim(claim_text)<>''), tombstoned_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id,id), UNIQUE(workspace_id,id,opportunity_id),
  FOREIGN KEY(workspace_id,draft_id,opportunity_id) REFERENCES public.intentlead_drafts(workspace_id,id,opportunity_id) ON DELETE CASCADE
);
CREATE TABLE public.intentlead_draft_claim_evidence (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE, claim_id uuid NOT NULL, opportunity_id uuid NOT NULL, evidence_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(claim_id,evidence_id),
  FOREIGN KEY(workspace_id,claim_id,opportunity_id) REFERENCES public.intentlead_draft_claims(workspace_id,id,opportunity_id) ON DELETE CASCADE,
  FOREIGN KEY(workspace_id,opportunity_id,evidence_id) REFERENCES public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
);

DO $$ DECLARE v_table text; BEGIN FOREACH v_table IN ARRAY ARRAY[
  'intentlead_suppression_entries','intentlead_people','intentlead_person_evidence','intentlead_buyer_candidates','intentlead_buyer_candidate_evidence',
  'intentlead_contact_points','intentlead_contact_point_evidence','intentlead_contact_verifications','intentlead_contact_verification_evidence',
  'intentlead_conversation_briefs','intentlead_conversation_brief_claims','intentlead_conversation_brief_claim_evidence',
  'intentlead_drafts','intentlead_draft_claims','intentlead_draft_claim_evidence'
] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',v_table);
  EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY',v_table);
  EXECUTE format('CREATE POLICY intentlead_workspace_read ON public.%I FOR SELECT TO authenticated USING (public.intentlead_is_workspace_member(workspace_id))',v_table);
  EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',v_table);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE public.%I TO service_role',v_table);
END LOOP; END $$;

CREATE TRIGGER intentlead_touch_updated_at BEFORE UPDATE ON public.intentlead_people
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_touch_updated_at();
CREATE TRIGGER intentlead_touch_updated_at BEFORE UPDATE ON public.intentlead_contact_points
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_touch_updated_at();
CREATE TRIGGER intentlead_touch_updated_at BEFORE UPDATE ON public.intentlead_drafts
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_touch_updated_at();
