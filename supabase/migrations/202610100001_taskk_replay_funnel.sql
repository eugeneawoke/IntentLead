CREATE OR REPLACE FUNCTION public.intentlead_get_self_prospecting_candidate(
  p_job_id uuid, p_worker_id text, p_lease_token uuid, p_candidate_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  v_job public.intentlead_jobs%ROWTYPE;
  v_result public.intentlead_job_candidate_results%ROWTYPE;
  v_company_identity text;
BEGIN
  SELECT * INTO v_job FROM public.intentlead_jobs WHERE id=p_job_id AND lease_owner=p_worker_id
    AND lease_token=p_lease_token AND state IN ('LEASED','RUNNING') AND lease_expires_at>clock_timestamp()
    AND market_profile_key='EN_DISCOVERY_ONLY' AND capability='SOURCE_SEARCH' AND job_type='OPPORTUNITY_DISCOVERY';
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_active_lease'; END IF;
  IF p_candidate_key IS NULL OR btrim(p_candidate_key)='' OR length(p_candidate_key)>160 THEN RAISE EXCEPTION 'invalid_candidate_key'; END IF;

  SELECT * INTO v_result FROM public.intentlead_job_candidate_results
    WHERE workspace_id=v_job.workspace_id AND job_id=p_job_id AND candidate_key=p_candidate_key;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT coalesce(c.domain, o.company_id::text) INTO v_company_identity
    FROM public.intentlead_opportunities o
    LEFT JOIN public.intentlead_companies c
      ON c.workspace_id=o.workspace_id AND c.id=o.company_id
    WHERE o.workspace_id=v_job.workspace_id AND o.id=v_result.opportunity_id;

  RETURN jsonb_build_object(
    'opportunityId', v_result.opportunity_id,
    'state', v_result.opportunity_state,
    'signalConfirmed', NOT (v_result.policy_reasons && ARRAY['SIGNAL_FAMILY_UNSUPPORTED','SIGNAL_TOO_OLD']::text[]),
    'companyIdentity', v_company_identity
  );
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_get_self_prospecting_candidate(uuid,text,uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_self_prospecting_candidate(uuid,text,uuid,text) TO service_role;
