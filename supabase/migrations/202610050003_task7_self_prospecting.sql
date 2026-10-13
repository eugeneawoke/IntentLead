CREATE TABLE public.intentlead_job_candidate_results (
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  job_id uuid NOT NULL,
  candidate_key text NOT NULL CHECK (btrim(candidate_key) <> '' AND length(candidate_key) <= 160),
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{32}$'),
  opportunity_id uuid NOT NULL,
  opportunity_state text NOT NULL CHECK (opportunity_state IN ('HUMAN_REVIEW','MODEL_REJECTED','INSUFFICIENT_EVIDENCE')),
  model_decision text CHECK (model_decision IS NULL OR model_decision IN ('QUALIFY','REVIEW','REJECT')),
  policy_reasons text[] NOT NULL,
  grounded_claims jsonb NOT NULL CHECK (jsonb_typeof(grounded_claims) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, job_id, candidate_key),
  UNIQUE (workspace_id, opportunity_id),
  FOREIGN KEY (workspace_id, job_id) REFERENCES public.intentlead_jobs(workspace_id,id),
  FOREIGN KEY (workspace_id, opportunity_id) REFERENCES public.intentlead_opportunities(workspace_id,id)
);
ALTER TABLE public.intentlead_job_candidate_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY intentlead_workspace_read ON public.intentlead_job_candidate_results
  FOR SELECT TO authenticated USING (public.intentlead_is_workspace_member(workspace_id));
REVOKE ALL ON TABLE public.intentlead_job_candidate_results FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_task7_claim_supported(p_claim text, p_items jsonb, p_ids uuid[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public AS $$
DECLARE v_item jsonb; v_claim text := regexp_replace(lower(p_claim), '[^[:alnum:]]+', '', 'g');
BEGIN
  IF btrim(p_claim) = '' OR cardinality(p_ids) = 0 THEN RETURN false; END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    IF (v_item->>'id')::uuid = ANY(p_ids) THEN
      IF regexp_replace(lower(coalesce(v_item->>'excerpt','')), '[^[:alnum:]]+', '', 'g') = v_claim THEN RETURN true; END IF;
      IF EXISTS (
        WITH RECURSIVE nodes(value) AS (
          SELECT v_item->'structuredFacts'
          UNION ALL
          SELECT child.value FROM nodes n CROSS JOIN LATERAL (
            SELECT entry.value FROM jsonb_each(CASE WHEN jsonb_typeof(n.value)='object' THEN n.value ELSE '{}'::jsonb END) entry
            UNION ALL SELECT entry.value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(n.value)='array' THEN n.value ELSE '[]'::jsonb END) entry
          ) child
        )
        SELECT 1 FROM nodes WHERE jsonb_typeof(value) IN ('string','number')
          AND regexp_replace(lower(value #>> '{}'), '[^[:alnum:]]+', '', 'g') = v_claim
      ) THEN RETURN true; END IF;
    END IF;
  END LOOP;
  RETURN false;
EXCEPTION WHEN others THEN RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_task7_claim_supported(text,jsonb,uuid[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_get_self_prospecting_candidate(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_candidate_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE v_job public.intentlead_jobs%ROWTYPE; v_result public.intentlead_job_candidate_results%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id=p_job_id AND lease_owner=p_worker_id
    AND lease_token=p_lease_token AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH' AND job_type='OPPORTUNITY_DISCOVERY';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;
  IF p_candidate_key IS NULL OR btrim(p_candidate_key)='' OR length(p_candidate_key)>160 THEN RAISE EXCEPTION 'invalid_candidate_key'; END IF;
  SELECT * INTO v_result FROM public.intentlead_job_candidate_results
    WHERE workspace_id=v_job.workspace_id AND job_id=p_job_id AND candidate_key=p_candidate_key;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('opportunityId',v_result.opportunity_id,'state',v_result.opportunity_state);
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_get_self_prospecting_candidate(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_self_prospecting_candidate(uuid,text,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.intentlead_persist_self_prospecting_candidate(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_candidate_key text, p_slice jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE; v_brief public.intentlead_discovery_briefs%ROWTYPE;
  v_existing public.intentlead_job_candidate_results%ROWTYPE; v_workspace uuid;
  v_run jsonb; v_source jsonb; v_evidence jsonb; v_claim jsonb; v_company jsonb;
  v_opportunity jsonb; v_assessment jsonb; v_opportunity_evidence uuid[]; v_distinct_evidence uuid[];
  v_claim_ids uuid[]; v_claim_refs uuid[];
  v_run_id uuid; v_source_id uuid; v_evidence_id uuid; v_company_id uuid;
  v_opportunity_id uuid; v_assessment_id uuid; v_hash text; v_seen_runs uuid[] := '{}'::uuid[];
  v_decision text; v_policy_reasons text[]; v_rejection text[]; v_review text[];
BEGIN
  IF p_job_id IS NULL OR p_worker_id IS NULL OR btrim(p_worker_id)='' OR p_lease_token IS NULL
    OR p_candidate_key IS NULL OR btrim(p_candidate_key)='' OR length(p_candidate_key)>160
    OR p_slice IS NULL OR jsonb_typeof(p_slice)<>'object' THEN RAISE EXCEPTION 'invalid_candidate_input'; END IF;
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id=p_job_id AND lease_owner=p_worker_id
    AND lease_token=p_lease_token AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH' AND job_type='OPPORTUNITY_DISCOVERY' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;
  v_workspace := v_job.workspace_id;
  SELECT b.* INTO v_brief FROM public.intentlead_discovery_briefs b
    JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
    WHERE b.id=v_job.discovery_brief_id AND b.workspace_id=v_workspace AND m.profile_key='EN_DISCOVERY_ONLY'
      AND m.workflow='DISCOVERY_ONLY' AND m.capabilities @> ARRAY['SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT','HUMAN_REVIEW']::text[]
      AND m.disabled_capabilities @> ARRAY['PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION','OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED']::text[] FOR SHARE OF b,m;
  IF NOT FOUND THEN RAISE EXCEPTION 'job_discovery_context_invalid'; END IF;
  IF NOT public.intentlead_jsonb_keys_allowed(p_slice,ARRAY['schemaVersion','candidateKey','modelDecision','policyReasons','groundedClaims','providerRuns','sourceItems','evidenceItems','company','opportunity','assessment'])
    OR NOT (p_slice ?& ARRAY['schemaVersion','candidateKey','modelDecision','policyReasons','groundedClaims','providerRuns','sourceItems','evidenceItems','company','opportunity','assessment'])
    OR p_slice->>'schemaVersion'<>'1' OR p_slice->>'candidateKey'<>p_candidate_key
    OR jsonb_typeof(p_slice->'policyReasons')<>'array' OR jsonb_array_length(p_slice->'policyReasons')>16
    OR jsonb_typeof(p_slice->'groundedClaims') NOT IN ('array','null')
    OR jsonb_typeof(p_slice->'providerRuns')<>'array' OR jsonb_array_length(p_slice->'providerRuns') NOT BETWEEN 1 AND 32
    OR jsonb_typeof(p_slice->'sourceItems')<>'array' OR jsonb_array_length(p_slice->'sourceItems') NOT BETWEEN 1 AND 16
    OR jsonb_typeof(p_slice->'evidenceItems')<>'array' OR jsonb_array_length(p_slice->'evidenceItems') NOT BETWEEN 1 AND 16
    OR jsonb_typeof(p_slice->'opportunity')<>'object'
  THEN RAISE EXCEPTION 'invalid_candidate_shape'; END IF;

  v_opportunity:=p_slice->'opportunity'; v_assessment:=p_slice->'assessment'; v_company:=p_slice->'company';
  IF NOT public.intentlead_jsonb_keys_allowed(v_opportunity,ARRAY['id','state','signal','jurisdiction','evidenceIds','assessmentId','createdAt','updatedAt'])
    OR NOT (v_opportunity ?& ARRAY['id','state','signal','jurisdiction','evidenceIds','assessmentId','createdAt','updatedAt'])
    OR NOT public.intentlead_valid_signal(v_opportunity->'signal')
    OR jsonb_typeof(v_opportunity->'evidenceIds')<>'array' OR jsonb_array_length(v_opportunity->'evidenceIds')=0
    OR (v_opportunity->'jurisdiction'<>'null'::jsonb AND NOT public.intentlead_valid_jurisdictions(jsonb_build_array(v_opportunity->'jurisdiction')))
  THEN RAISE EXCEPTION 'invalid_candidate_opportunity'; END IF;
  v_opportunity_id:=(v_opportunity->>'id')::uuid;
  SELECT array_agg((value #>> '{}')::uuid), array_agg(DISTINCT (value #>> '{}')::uuid) INTO v_opportunity_evidence,v_distinct_evidence
    FROM jsonb_array_elements(v_opportunity->'evidenceIds');
  IF cardinality(v_opportunity_evidence)<>cardinality(v_distinct_evidence) THEN RAISE EXCEPTION 'duplicate_candidate_evidence'; END IF;
  IF jsonb_typeof(v_company)='null' THEN v_company_id:=NULL;
  ELSE
    IF NOT public.intentlead_jsonb_keys_allowed(v_company,ARRAY['id','canonicalName','domain','jurisdiction','confidence'])
      OR NOT (v_company ?& ARRAY['id','canonicalName','domain','jurisdiction','confidence'])
      OR btrim(v_company->>'canonicalName')='' OR jsonb_typeof(v_company->'confidence')<>'number'
      OR (v_company->>'confidence')::numeric NOT BETWEEN 0 AND 1
      OR (v_company->'domain'<>'null'::jsonb AND (v_company->>'domain' !~ '^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'))
      OR (v_company->'jurisdiction'<>'null'::jsonb) THEN RAISE EXCEPTION 'invalid_candidate_company'; END IF;
    v_company_id:=(v_company->>'id')::uuid;
  END IF;
  IF jsonb_typeof(v_assessment)='null' THEN
    IF v_opportunity->>'state'<>'INSUFFICIENT_EVIDENCE' OR jsonb_typeof(v_company)<>'null'
      OR v_opportunity->'assessmentId'<>'null'::jsonb
      OR jsonb_typeof(p_slice->'modelDecision')<>'null' OR jsonb_typeof(p_slice->'groundedClaims')<>'null'
    THEN RAISE EXCEPTION 'incomplete_candidate_state_mismatch'; END IF;
  ELSE
    IF NOT public.intentlead_jsonb_keys_allowed(v_assessment,ARRAY['id','decision','problemType','problemStatement','evidenceStrength','explicitness','urgency','freshness','commercialImpact','icpFit','companyConfidence','buyerRelevance','actionability','confidence','evidenceIds','rejectionReasons','reviewReasons','modelRunId','assessedAt'])
      OR NOT (v_assessment ?& ARRAY['id','decision','problemType','problemStatement','evidenceStrength','explicitness','urgency','freshness','commercialImpact','icpFit','companyConfidence','buyerRelevance','actionability','confidence','evidenceIds','rejectionReasons','reviewReasons','modelRunId','assessedAt'])
      OR jsonb_typeof(v_company)<>'object' OR jsonb_typeof(p_slice->'groundedClaims')<>'array'
      OR jsonb_array_length(p_slice->'groundedClaims')=0
      OR jsonb_typeof(p_slice->'modelDecision')<>'string'
      OR p_slice->>'modelDecision' NOT IN ('QUALIFY','REVIEW','REJECT')
      OR jsonb_typeof(v_opportunity->'assessmentId')<>'string' OR (v_opportunity->>'assessmentId')<>(v_assessment->>'id')
      OR (p_slice->>'modelDecision'='REJECT' AND (v_opportunity->>'state'<>'MODEL_REJECTED' OR v_assessment->>'decision'<>'REJECT'))
      OR (p_slice->>'modelDecision'<>'REJECT' AND (v_opportunity->>'state'<>'HUMAN_REVIEW' OR v_assessment->>'decision'<>'REVIEW'))
    THEN RAISE EXCEPTION 'invalid_candidate_assessment'; END IF;
    v_assessment_id:=(v_assessment->>'id')::uuid;
    v_decision:=v_assessment->>'decision';
    v_rejection:=ARRAY(SELECT jsonb_array_elements_text(v_assessment->'rejectionReasons'));
    v_review:=ARRAY(SELECT jsonb_array_elements_text(v_assessment->'reviewReasons'));
    IF (v_decision='REJECT' AND (cardinality(v_rejection)=0 OR cardinality(v_review)<>0))
      OR (v_decision='REVIEW' AND (cardinality(v_rejection)<>0 OR cardinality(v_review)=0))
      OR (v_assessment->>'modelRunId' IS NULL) THEN RAISE EXCEPTION 'invalid_candidate_assessment_decision'; END IF;
  END IF;

  v_policy_reasons:=ARRAY(SELECT jsonb_array_elements_text(p_slice->'policyReasons'));
  IF EXISTS (SELECT 1 FROM unnest(v_policy_reasons) r WHERE r NOT IN ('SIGNAL_FAMILY_UNSUPPORTED','SIGNAL_TOO_OLD','SIGNAL_TOO_WEAK','INSUFFICIENT_EVIDENCE','COMPANY_UNCERTAIN','WRONG_COMPANY','LOW_COMPANY_CONFIDENCE','MODEL_REVIEW','MODEL_REJECTED','POLICY_REVIEW_REQUIRED','LOW_EXPLICITNESS','LOW_EVIDENCE_STRENGTH','LOW_ICP_FIT','LOW_ACTIONABILITY','LOW_CONFIDENCE')) THEN RAISE EXCEPTION 'invalid_candidate_policy_reason'; END IF;
  v_hash:=md5(p_slice::text);
  SELECT * INTO v_existing FROM public.intentlead_job_candidate_results WHERE workspace_id=v_workspace AND job_id=p_job_id AND candidate_key=p_candidate_key FOR UPDATE;
  IF FOUND THEN IF v_existing.input_hash<>v_hash THEN RAISE EXCEPTION 'idempotency_conflict'; END IF; RETURN v_existing.opportunity_id; END IF;

  FOR v_run IN SELECT value FROM jsonb_array_elements(p_slice->'providerRuns') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_run,ARRAY['id','provider','providerVersion','capability','status','startedAt','finishedAt','latencyMs','requestCount','recordCount','configuredCost','reservedCost','actualCost','currency','provenance','limitations'])
      OR NOT (v_run ?& ARRAY['id','provider','providerVersion','capability','status','startedAt','finishedAt','latencyMs','requestCount','recordCount','configuredCost','reservedCost','actualCost','currency','provenance','limitations'])
      OR v_run->>'provider' NOT IN ('reddit','hackernews','exa','serper','openai')
      OR v_run->>'capability' NOT IN ('SOURCE_SEARCH','COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT')
      OR (v_run->>'provider' IN ('reddit','hackernews') AND v_run->>'capability'<>'SOURCE_SEARCH')
      OR (v_run->>'provider' IN ('exa','serper') AND v_run->>'capability'<>'COMPANY_RESOLUTION')
      OR (v_run->>'provider'='openai' AND v_run->>'capability' NOT IN ('COMPANY_RESOLUTION','OPPORTUNITY_ASSESSMENT'))
      OR v_run->>'status' NOT IN ('SUCCEEDED','PARTIAL','FAILED','RATE_LIMITED','TIMEOUT')
      OR jsonb_typeof(v_run->'id')<>'string'
      OR jsonb_typeof(v_run->'providerVersion') NOT IN ('string','null')
      OR jsonb_typeof(v_run->'latencyMs')<>'number' OR (v_run->>'latencyMs')::numeric<0 OR trunc((v_run->>'latencyMs')::numeric)<>(v_run->>'latencyMs')::numeric
      OR jsonb_typeof(v_run->'requestCount')<>'number' OR (v_run->>'requestCount')::numeric<0 OR trunc((v_run->>'requestCount')::numeric)<>(v_run->>'requestCount')::numeric
      OR jsonb_typeof(v_run->'recordCount')<>'number' OR (v_run->>'recordCount')::numeric<0 OR trunc((v_run->>'recordCount')::numeric)<>(v_run->>'recordCount')::numeric
      OR jsonb_typeof(v_run->'configuredCost') NOT IN ('number','null') OR (v_run->'configuredCost'<>'null'::jsonb AND (v_run->>'configuredCost')::numeric<0)
      OR jsonb_typeof(v_run->'reservedCost') NOT IN ('number','null') OR (v_run->'reservedCost'<>'null'::jsonb AND (v_run->>'reservedCost')::numeric<0)
      OR jsonb_typeof(v_run->'actualCost') NOT IN ('number','null') OR (v_run->'actualCost'<>'null'::jsonb AND (v_run->>'actualCost')::numeric<0)
      OR jsonb_typeof(v_run->'currency') NOT IN ('string','null')
      OR (v_run->'currency'<>'null'::jsonb AND v_run->>'currency' !~ '^[A-Z]{3}$')
      OR jsonb_typeof(v_run->'startedAt')<>'string' OR jsonb_typeof(v_run->'finishedAt')<>'string'
      OR jsonb_typeof(v_run->'provenance')<>'array' OR jsonb_typeof(v_run->'limitations')<>'array'
    THEN RAISE EXCEPTION 'invalid_candidate_provider_run'; END IF;
    v_run_id:=(v_run->>'id')::uuid;
    IF v_run_id=ANY(v_seen_runs) THEN RAISE EXCEPTION 'duplicate_candidate_provider_run'; END IF;
    v_seen_runs:=array_append(v_seen_runs,v_run_id);
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_run->'provenance') p
      WHERE NOT public.intentlead_jsonb_keys_allowed(p,ARRAY['providerSourceId','sourceUrl','capturedAt'])
        OR NOT (p ?& ARRAY['providerSourceId','sourceUrl','capturedAt']) OR btrim(p->>'providerSourceId')=''
        OR jsonb_typeof(p->'sourceUrl') NOT IN ('string','null') OR jsonb_typeof(p->'capturedAt')<>'string'
        OR (p->'sourceUrl'<>'null'::jsonb AND p->>'sourceUrl' !~ '^https?://'))
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_run->'limitations') p WHERE jsonb_typeof(p)<>'string')
    THEN RAISE EXCEPTION 'invalid_candidate_provider_provenance'; END IF;
    IF EXISTS (SELECT 1 FROM public.intentlead_provider_runs r WHERE r.id=v_run_id AND r.workspace_id=v_workspace AND r.job_id=p_job_id
      AND (r.provider<>v_run->>'provider' OR r.capability<>v_run->>'capability' OR r.status<>v_run->>'status'
        OR coalesce(r.provider_version,'')<>coalesce(v_run->>'providerVersion','')))
    THEN RAISE EXCEPTION 'provider_run_identity_conflict'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs WHERE id=v_run_id AND workspace_id=v_workspace AND job_id=p_job_id) THEN
      INSERT INTO public.intentlead_provider_runs(id,workspace_id,job_id,capability,provider,provider_version,status,request_metadata,response_metadata,latency_ms,usage_units,cost_amount,currency,started_at,finished_at)
      VALUES(v_run_id,v_workspace,p_job_id,v_run->>'capability',v_run->>'provider',v_run->>'providerVersion',v_run->>'status',
        jsonb_build_object('traceId',v_job.trace_id,'requestCount',v_run->'requestCount','configuredCost',v_run->'configuredCost','reservedCost',v_run->'reservedCost'),
        jsonb_build_object('recordCount',v_run->'recordCount','provenance',v_run->'provenance','limitations',v_run->'limitations'),
        (v_run->>'latencyMs')::integer,(v_run->>'requestCount')::numeric,(v_run->>'actualCost')::numeric,v_run->>'currency',
        (v_run->>'startedAt')::timestamptz,(v_run->>'finishedAt')::timestamptz);
    END IF;
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs WHERE job_id=p_job_id AND workspace_id=v_workspace AND capability='SOURCE_SEARCH') THEN RAISE EXCEPTION 'candidate_source_run_missing'; END IF;
  IF v_assessment IS NOT NULL AND v_assessment<>'null'::jsonb AND NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs WHERE id=(v_assessment->>'modelRunId')::uuid AND job_id=p_job_id AND workspace_id=v_workspace AND capability='OPPORTUNITY_ASSESSMENT' AND provider='openai' AND status='SUCCEEDED') THEN RAISE EXCEPTION 'candidate_assessment_run_missing'; END IF;

  FOR v_source IN SELECT value FROM jsonb_array_elements(p_slice->'sourceItems') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_source,ARRAY['id','provider','externalId','sourceUrl','content','normalizedFacts','provenance','contentHash','capturedAt','publishedAt'])
      OR NOT (v_source ?& ARRAY['id','provider','externalId','sourceUrl','content','normalizedFacts','provenance','contentHash','capturedAt','publishedAt'])
      OR v_source->>'provider' NOT IN ('reddit','hackernews','exa','serper') OR btrim(v_source->>'externalId')=''
      OR jsonb_typeof(v_source->'sourceUrl')<>'string' OR v_source->>'sourceUrl' !~ '^https?://'
      OR btrim(coalesce(v_source->>'content',''))='' OR v_source->>'contentHash' !~ '^[0-9a-fA-F]{64}$'
      OR NOT public.intentlead_valid_structured_facts(v_source->'normalizedFacts') OR NOT public.intentlead_valid_provenance(v_source->'provenance')
      OR jsonb_typeof(v_source->'capturedAt')<>'string' OR jsonb_typeof(v_source->'publishedAt') NOT IN ('string','null')
      OR v_source->'provenance'->'rawArtifactId'<>'null'::jsonb THEN RAISE EXCEPTION 'invalid_candidate_source'; END IF;
    v_source_id:=(v_source->>'id')::uuid; v_run_id:=(v_source->'provenance'->>'providerRunId')::uuid;
    IF v_source->'provenance'->>'sourceId'<>v_source_id::text OR NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs r WHERE r.id=v_run_id AND r.workspace_id=v_workspace AND r.job_id=p_job_id AND r.provider=v_source->>'provider' AND r.status IN ('SUCCEEDED','PARTIAL') AND r.capability=CASE WHEN v_source->>'provider' IN ('reddit','hackernews') THEN 'SOURCE_SEARCH' ELSE 'COMPANY_RESOLUTION' END AND EXISTS (SELECT 1 FROM jsonb_array_elements(r.response_metadata->'provenance') p WHERE p->>'providerSourceId'=v_source->>'externalId' AND p->>'sourceUrl'=v_source->>'sourceUrl')) THEN RAISE EXCEPTION 'invalid_candidate_source_provenance'; END IF;
    INSERT INTO public.intentlead_source_items(id,workspace_id,provider,external_id,provider_run_id,source_url,content,normalized_facts,provenance,content_hash,captured_at,published_at)
      VALUES(v_source_id,v_workspace,v_source->>'provider',v_source->>'externalId',v_run_id,v_source->>'sourceUrl',v_source->>'content',v_source->'normalizedFacts',v_source->'provenance',v_source->>'contentHash',(v_source->>'capturedAt')::timestamptz,(v_source->>'publishedAt')::timestamptz);
  END LOOP;

  FOR v_evidence IN SELECT value FROM jsonb_array_elements(p_slice->'evidenceItems') LOOP
    IF NOT public.intentlead_jsonb_keys_allowed(v_evidence,ARRAY['id','sourceItemId','type','sourceUrl','capturedAt','excerpt','structuredFacts','verificationMethod','confidence','contentHash','provenance'])
      OR NOT (v_evidence ?& ARRAY['id','sourceItemId','type','sourceUrl','capturedAt','excerpt','structuredFacts','verificationMethod','confidence','contentHash','provenance'])
      OR v_evidence->>'type' NOT IN ('text','structured_fact','screenshot','document','observation')
      OR btrim(v_evidence->>'verificationMethod')='' OR (v_evidence->>'confidence')::numeric NOT BETWEEN 0 AND 1
      OR jsonb_typeof(v_evidence->'sourceUrl')<>'string' OR v_evidence->>'sourceUrl' !~ '^https?://'
      OR jsonb_typeof(v_evidence->'capturedAt')<>'string' OR jsonb_typeof(v_evidence->'excerpt') NOT IN ('string','null')
      OR v_evidence->>'contentHash' !~ '^[0-9a-fA-F]{64}$' OR NOT public.intentlead_valid_structured_facts(v_evidence->'structuredFacts')
      OR NOT public.intentlead_valid_provenance(v_evidence->'provenance') OR v_evidence->'provenance'->'rawArtifactId'<>'null'::jsonb
    THEN RAISE EXCEPTION 'invalid_candidate_evidence'; END IF;
    v_evidence_id:=(v_evidence->>'id')::uuid; v_source_id:=(v_evidence->>'sourceItemId')::uuid;
    v_run_id:=(v_evidence->'provenance'->>'providerRunId')::uuid;
    IF v_evidence->'provenance'->>'sourceId'<>v_source_id::text OR NOT EXISTS (SELECT 1 FROM public.intentlead_source_items WHERE id=v_source_id AND workspace_id=v_workspace AND provider_run_id=v_run_id AND source_url=v_evidence->>'sourceUrl' AND captured_at=(v_evidence->>'capturedAt')::timestamptz)
      OR NOT EXISTS (SELECT 1 FROM public.intentlead_provider_runs r JOIN public.intentlead_source_items s ON s.id=v_source_id AND s.workspace_id=v_workspace AND s.provider_run_id=v_run_id WHERE r.id=v_run_id AND r.workspace_id=v_workspace AND r.job_id=p_job_id)
    THEN RAISE EXCEPTION 'invalid_candidate_evidence_provenance'; END IF;
    INSERT INTO public.intentlead_evidence_items(id,workspace_id,source_item_id,provider_run_id,evidence_type,source_url,captured_at,excerpt,structured_facts,verification_method,confidence,content_hash,provenance)
      VALUES(v_evidence_id,v_workspace,v_source_id,v_run_id,v_evidence->>'type',v_evidence->>'sourceUrl',(v_evidence->>'capturedAt')::timestamptz,v_evidence->>'excerpt',v_evidence->'structuredFacts',v_evidence->>'verificationMethod',(v_evidence->>'confidence')::numeric,v_evidence->>'contentHash',v_evidence->'provenance');
  END LOOP;
  IF EXISTS (SELECT 1 FROM unnest(v_opportunity_evidence) x WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_slice->'evidenceItems') e WHERE (e->>'id')::uuid=x) OR NOT EXISTS (SELECT 1 FROM public.intentlead_evidence_items e WHERE e.id=x AND e.workspace_id=v_workspace AND e.tombstoned_at IS NULL)) THEN RAISE EXCEPTION 'candidate_evidence_reference_missing'; END IF;
  IF v_assessment IS NOT NULL AND v_assessment<>'null'::jsonb THEN
    v_claim_ids:=ARRAY(SELECT jsonb_array_elements_text(v_assessment->'evidenceIds')::uuid);
    IF cardinality(v_claim_ids)=0 OR cardinality(v_claim_ids)<>(SELECT count(DISTINCT x) FROM unnest(v_claim_ids) x)
      OR EXISTS (SELECT 1 FROM unnest(v_claim_ids) x WHERE NOT x=ANY(v_opportunity_evidence)) THEN RAISE EXCEPTION 'invalid_assessment_evidence_references'; END IF;
    FOR v_claim IN SELECT value FROM jsonb_array_elements(p_slice->'groundedClaims') LOOP
      IF NOT public.intentlead_jsonb_keys_allowed(v_claim,ARRAY['text','evidenceIds']) OR NOT (v_claim ?& ARRAY['text','evidenceIds'])
        OR jsonb_typeof(v_claim->'evidenceIds')<>'array' THEN RAISE EXCEPTION 'invalid_grounded_claim'; END IF;
      v_claim_refs:=ARRAY(SELECT jsonb_array_elements_text(v_claim->'evidenceIds')::uuid);
      IF cardinality(v_claim_refs)=0 OR cardinality(v_claim_refs)<>(SELECT count(DISTINCT x) FROM unnest(v_claim_refs) x)
        OR EXISTS (SELECT 1 FROM unnest(v_claim_refs) x WHERE NOT x=ANY(v_claim_ids))
        OR NOT public.intentlead_task7_claim_supported(v_claim->>'text',p_slice->'evidenceItems',v_claim_refs)
      THEN RAISE EXCEPTION 'unsupported_grounded_claim'; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM unnest(v_claim_ids) x WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_slice->'groundedClaims') c
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(c->'evidenceIds') r WHERE r::uuid=x)
    )) THEN RAISE EXCEPTION 'ungrounded_assessment_evidence'; END IF;
    IF regexp_replace(lower(v_assessment->>'problemStatement'),'[^[:alnum:]]+','','g') NOT IN
      (SELECT regexp_replace(lower(value->>'text'),'[^[:alnum:]]+','','g') FROM jsonb_array_elements(p_slice->'groundedClaims'))
    THEN RAISE EXCEPTION 'unsupported_problem_statement'; END IF;
  END IF;

  IF v_company IS NOT NULL AND v_company<>'null'::jsonb THEN
    IF v_company->>'domain' IS NOT NULL THEN
      SELECT id INTO v_company_id FROM public.intentlead_companies WHERE workspace_id=v_workspace AND lower(domain)=lower(v_company->>'domain') FOR UPDATE;
      IF FOUND THEN
        IF (SELECT canonical_name FROM public.intentlead_companies WHERE id=v_company_id AND workspace_id=v_workspace)<>v_company->>'canonicalName' THEN RAISE EXCEPTION 'company_domain_identity_conflict'; END IF;
      ELSE v_company_id:=(v_company->>'id')::uuid; END IF;
    ELSE v_company_id:=(v_company->>'id')::uuid; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.intentlead_companies WHERE id=v_company_id AND workspace_id=v_workspace) THEN
      INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,jurisdiction,confidence)
        VALUES(v_company_id,v_workspace,v_company->>'canonicalName',v_company->>'domain',NULL,(v_company->>'confidence')::numeric);
    END IF;
  END IF;
  IF v_assessment IS NOT NULL AND v_assessment<>'null'::jsonb THEN v_assessment_id:=(v_assessment->>'id')::uuid; ELSE v_assessment_id:=NULL; END IF;
  IF (v_assessment_id IS NULL AND v_opportunity->>'state'<>'INSUFFICIENT_EVIDENCE')
    OR (v_assessment_id IS NOT NULL AND v_company_id IS NULL)
    OR (v_opportunity->>'state'='HUMAN_REVIEW' AND p_slice->>'modelDecision'='REJECT')
    OR (v_opportunity->>'state'='MODEL_REJECTED' AND p_slice->>'modelDecision'<>'REJECT')
  THEN RAISE EXCEPTION 'candidate_state_reference_mismatch'; END IF;
  INSERT INTO public.intentlead_opportunities(id,workspace_id,discovery_brief_id,company_id,current_assessment_id,state,signal,jurisdiction,created_at,updated_at)
    VALUES(v_opportunity_id,v_workspace,v_brief.id,v_company_id,v_assessment_id,v_opportunity->>'state',v_opportunity->'signal',NULL,(v_opportunity->>'createdAt')::timestamptz,(v_opportunity->>'updatedAt')::timestamptz);
  INSERT INTO public.intentlead_opportunity_evidence(workspace_id,opportunity_id,evidence_id)
    SELECT v_workspace,v_opportunity_id,x FROM unnest(v_opportunity_evidence) x;
  IF v_assessment_id IS NOT NULL THEN
    INSERT INTO public.intentlead_opportunity_assessments(id,workspace_id,opportunity_id,version,decision,signal,problem_type,problem_statement,evidence_strength,explicitness,urgency,freshness,commercial_impact,icp_fit,company_confidence,buyer_relevance,actionability,confidence,rejection_reasons,review_reasons,model_run_id,assessed_at)
    VALUES(v_assessment_id,v_workspace,v_opportunity_id,1,v_decision,v_opportunity->'signal',v_assessment->>'problemType',v_assessment->>'problemStatement',(v_assessment->>'evidenceStrength')::numeric,(v_assessment->>'explicitness')::numeric,(v_assessment->>'urgency')::numeric,(v_assessment->>'freshness')::numeric,(v_assessment->>'commercialImpact')::numeric,(v_assessment->>'icpFit')::numeric,(v_assessment->>'companyConfidence')::numeric,(v_assessment->>'buyerRelevance')::numeric,(v_assessment->>'actionability')::numeric,(v_assessment->>'confidence')::numeric,v_rejection,v_review,(v_assessment->>'modelRunId')::uuid,(v_assessment->>'assessedAt')::timestamptz);
    INSERT INTO public.intentlead_assessment_evidence(workspace_id,assessment_id,opportunity_id,evidence_id)
      SELECT v_workspace,v_assessment_id,v_opportunity_id,x FROM unnest(v_claim_ids) x;
  END IF;
  INSERT INTO public.intentlead_job_candidate_results(workspace_id,job_id,candidate_key,input_hash,opportunity_id,opportunity_state,model_decision,policy_reasons,grounded_claims)
    VALUES(v_workspace,p_job_id,p_candidate_key,v_hash,v_opportunity_id,v_opportunity->>'state',p_slice->>'modelDecision',v_policy_reasons,CASE WHEN p_slice->'groundedClaims'='null'::jsonb THEN '[]'::jsonb ELSE p_slice->'groundedClaims' END);
  RETURN v_opportunity_id;
EXCEPTION WHEN invalid_text_representation OR datetime_field_overflow OR numeric_value_out_of_range OR array_subscript_error THEN
  RAISE EXCEPTION 'invalid_candidate_shape';
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb) TO service_role;
