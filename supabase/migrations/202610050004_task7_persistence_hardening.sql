-- Task 7 review fixes: per-run source identity and database-enforced company grounding.
ALTER TABLE public.intentlead_source_items
  DROP CONSTRAINT IF EXISTS intentlead_source_items_workspace_id_provider_external_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS intentlead_source_items_workspace_provider_external_run_key
  ON public.intentlead_source_items(
    workspace_id, provider, external_id,
    (coalesce(provider_run_id, '00000000-0000-0000-0000-000000000000'::uuid))
  );
COMMENT ON INDEX public.intentlead_source_items_workspace_provider_external_run_key IS
  'Source identity is scoped to a provider run so later jobs can retain distinct immutable observations.';

CREATE OR REPLACE FUNCTION public.intentlead_task7_company_evidence_bound(p_slice jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = pg_catalog, public
AS $$
DECLARE
  v_company jsonb;
  v_name text;
  v_domain text;
BEGIN
  IF p_slice IS NULL OR jsonb_typeof(p_slice) <> 'object' THEN RETURN false; END IF;
  v_company := p_slice->'company';
  IF v_company = 'null'::jsonb THEN RETURN true; END IF;
  IF jsonb_typeof(v_company) <> 'object'
    OR jsonb_typeof(p_slice->'sourceItems') <> 'array'
    OR jsonb_typeof(p_slice->'evidenceItems') <> 'array'
    OR jsonb_typeof(p_slice->'providerRuns') <> 'array'
    OR jsonb_typeof(p_slice->'opportunity'->'evidenceIds') <> 'array'
  THEN RETURN false; END IF;
  v_name := btrim(v_company->>'canonicalName');
  v_domain := lower(btrim(v_company->>'domain'));
  IF v_name = '' OR v_domain = '' OR v_domain IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_slice->'evidenceItems') e(value)
    JOIN jsonb_array_elements(p_slice->'sourceItems') s(value)
      ON s.value->>'id' = e.value->>'sourceItemId'
    JOIN jsonb_array_elements(p_slice->'providerRuns') r(value)
      ON r.value->>'id' = e.value->'provenance'->>'providerRunId'
    WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(p_slice->'opportunity'->'evidenceIds') o(value)
        WHERE o.value = e.value->>'id'
      )
      AND s.value->>'provider' IN ('exa','serper')
      AND r.value->>'provider' = s.value->>'provider'
      AND r.value->>'capability' = 'COMPANY_RESOLUTION'
      AND r.value->>'status' = 'SUCCEEDED'
      AND e.value->'provenance'->>'providerRunId' = r.value->>'id'
      AND e.value->'structuredFacts'->>'companyName' = v_name
      AND lower(e.value->'structuredFacts'->>'companyDomain') = v_domain
      AND position(lower(v_name) IN lower(coalesce(e.value->>'excerpt',''))) > 0
      AND (
        lower(regexp_replace(split_part(split_part(e.value->>'sourceUrl','://',2),'/',1), ':[0-9]+$', '')) = v_domain
        OR lower(regexp_replace(split_part(split_part(e.value->>'sourceUrl','://',2),'/',1), ':[0-9]+$', '')) LIKE '%.' || v_domain
      )
      AND EXISTS (
        SELECT 1 FROM jsonb_array_elements(r.value->'provenance') p(value)
        WHERE p.value->>'providerSourceId' = s.value->>'externalId'
          AND p.value->>'sourceUrl' = s.value->>'sourceUrl'
      )
  );
EXCEPTION WHEN others THEN
  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_task7_company_evidence_bound(jsonb) FROM PUBLIC, anon, authenticated, service_role;

DO $$
BEGIN
  IF to_regprocedure('public.intentlead_persist_self_prospecting_candidate_task7_v1(uuid,text,uuid,text,jsonb)') IS NULL THEN
    ALTER FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)
      RENAME TO intentlead_persist_self_prospecting_candidate_task7_v1;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_persist_self_prospecting_candidate_task7_v1(uuid,text,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_persist_self_prospecting_candidate(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_candidate_key text, p_slice jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace uuid;
  v_company jsonb;
  v_company_id uuid;
  v_company_name text;
  v_domain text;
BEGIN
  IF NOT public.intentlead_task7_company_evidence_bound(p_slice) THEN
    RAISE EXCEPTION 'company_evidence_provenance_not_bound';
  END IF;
  v_company := p_slice->'company';
  IF v_company IS NOT NULL AND v_company <> 'null'::jsonb THEN
    SELECT workspace_id INTO v_workspace
    FROM public.intentlead_jobs
    WHERE id=p_job_id AND lease_owner=p_worker_id AND lease_token=p_lease_token
      AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
      AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH' AND job_type='OPPORTUNITY_DISCOVERY'
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;

    v_company_name := btrim(v_company->>'canonicalName');
    v_domain := lower(btrim(v_company->>'domain'));
    INSERT INTO public.intentlead_companies(id,workspace_id,canonical_name,domain,jurisdiction,confidence)
    VALUES ((v_company->>'id')::uuid,v_workspace,v_company_name,v_domain,NULL,(v_company->>'confidence')::numeric)
    ON CONFLICT (workspace_id, (lower(domain)) ) WHERE domain IS NOT NULL DO NOTHING;

    SELECT id,canonical_name INTO v_company_id,v_company_name
    FROM public.intentlead_companies
    WHERE workspace_id=v_workspace AND lower(domain)=v_domain
    FOR UPDATE;
    IF NOT FOUND OR v_company_name <> btrim(v_company->>'canonicalName') THEN
      RAISE EXCEPTION 'company_domain_identity_conflict';
    END IF;
  END IF;
  RETURN public.intentlead_persist_self_prospecting_candidate_task7_v1(
    p_job_id,p_worker_id,p_lease_token,p_candidate_key,p_slice
  );
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_persist_self_prospecting_candidate(uuid,text,uuid,text,jsonb)
  TO service_role;
