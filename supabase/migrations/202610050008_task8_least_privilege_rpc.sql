-- Keep authenticated browser reads behind narrow, membership-aware RPCs.
-- This list is the complete current IntentLead table set; shared legacy tables are untouched.
DO $$
DECLARE v_table text;
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
    'intentlead_deletion_tombstones', 'intentlead_outreach_drafts',
    'intentlead_outreach_draft_claims', 'intentlead_jobs', 'intentlead_job_step_attempts',
    'intentlead_job_discovery_slices', 'intentlead_job_step_provider_runs',
    'intentlead_job_candidate_results', 'intentlead_worker_nonces'
  ] LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.intentlead_discovery_setup_for_campaign(p_campaign_id uuid)
RETURNS TABLE(
  discovery_brief_id uuid, workspace_id uuid, profile_key text, workflow text,
  configuration jsonb, capabilities text[], disabled_capabilities text[]
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT b.id, b.workspace_id, m.profile_key, m.workflow, m.configuration,
    m.capabilities, m.disabled_capabilities
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m
    ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  JOIN public.workspaces w ON w.id=b.workspace_id
  WHERE b.legacy_campaign_id=p_campaign_id AND w.owner_id=auth.uid()
  ORDER BY b.created_at, b.id
  LIMIT 2
$$;
REVOKE ALL ON FUNCTION public.intentlead_discovery_setup_for_campaign(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_discovery_setup_for_campaign(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.intentlead_legacy_campaign_is_discovery_only(p_campaign_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.intentlead_discovery_briefs b
    JOIN public.intentlead_market_profiles m
      ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
    WHERE b.legacy_campaign_id=p_campaign_id
      AND public.intentlead_is_workspace_member(b.workspace_id)
      AND (m.profile_key='EN_DISCOVERY_ONLY' OR m.workflow='DISCOVERY_ONLY')
  )
$$;
REVOKE ALL ON FUNCTION public.intentlead_legacy_campaign_is_discovery_only(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_legacy_campaign_is_discovery_only(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.intentlead_build_opportunity_review_dto(
  p_opportunity_id uuid,
  p_include_evidence boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row record;
  v_total integer;
  v_active integer;
  v_evidence jsonb := '[]'::jsonb;
  v_result jsonb;
BEGIN
  SELECT o.*, c.canonical_name AS company_name, c.domain AS company_domain,
    c.confidence AS company_confidence, a.decision AS assessment_decision,
    a.confidence AS assessment_confidence, a.evidence_strength, a.freshness,
    a.commercial_impact, a.icp_fit, a.actionability, a.problem_statement,
    latest.decision AS latest_decision, latest.reviewed_at AS latest_reviewed_at
  INTO v_row
  FROM public.intentlead_opportunities o
  JOIN public.intentlead_discovery_briefs b ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  LEFT JOIN public.intentlead_companies c ON c.id=o.company_id AND c.workspace_id=o.workspace_id AND c.tombstoned_at IS NULL
  LEFT JOIN public.intentlead_opportunity_assessments a
    ON a.id=o.current_assessment_id AND a.workspace_id=o.workspace_id AND a.tombstoned_at IS NULL
  LEFT JOIN LATERAL (
    SELECT r.decision, r.reviewed_at FROM public.intentlead_human_reviews r
    WHERE r.workspace_id=o.workspace_id AND r.opportunity_id=o.id AND r.tombstoned_at IS NULL
    ORDER BY r.reviewed_at DESC, r.id DESC LIMIT 1
  ) latest ON true
  WHERE o.id=p_opportunity_id AND o.tombstoned_at IS NULL
    AND public.intentlead_is_workspace_member(o.workspace_id)
    AND o.state IN ('HUMAN_REVIEW','REJECTED','NEEDS_RESEARCH')
    AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
    AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
    AND NOT (m.capabilities && ARRAY[
      'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
      'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
    ]::text[]);
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT count(*), count(*) FILTER (WHERE oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL)
    INTO v_total, v_active
  FROM public.intentlead_opportunity_evidence oe
  LEFT JOIN public.intentlead_evidence_items e ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
  WHERE oe.workspace_id=v_row.workspace_id AND oe.opportunity_id=v_row.id;

  v_result := jsonb_build_object(
    'id', v_row.id, 'state', v_row.state, 'signal', v_row.signal,
    'company', CASE WHEN v_row.company_name IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_row.company_name, 'domain', v_row.company_domain, 'confidence', v_row.company_confidence
    ) END,
    'assessment', CASE WHEN v_row.assessment_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision', v_row.assessment_decision, 'confidence', v_row.assessment_confidence,
      'evidenceStrength', v_row.evidence_strength, 'freshness', v_row.freshness,
      'commercialImpact', v_row.commercial_impact, 'icpFit', v_row.icp_fit,
      'actionability', v_row.actionability,
      'problemStatement', CASE WHEN v_row.problem_statement IS NOT NULL
        AND char_length(btrim(v_row.problem_statement)) BETWEEN 1 AND 600
        AND v_row.problem_statement !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
        AND v_row.problem_statement !~* '(https?://|www\.)'
        AND v_row.problem_statement !~ '(^|[^[:alnum:]_])@[A-Za-z0-9_]{2,}'
        AND v_row.problem_statement !~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
        THEN btrim(v_row.problem_statement) END
    ) END,
    'evidenceCount', v_active,
    'evidenceStatus', CASE WHEN v_active=0 THEN 'MISSING' WHEN v_active<v_total THEN 'PARTIAL' ELSE 'COMPLETE' END,
    'latestReview', CASE WHEN v_row.latest_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision', v_row.latest_decision, 'reviewedAt', v_row.latest_reviewed_at
    ) END,
    'createdAt', v_row.created_at, 'updatedAt', v_row.updated_at
  );

  IF p_include_evidence THEN
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'id', e.id, 'sourceUrl', e.source_url,
      'provider', coalesce(r.provider, s.provider, 'unknown'), 'capturedAt', e.captured_at,
      'confidence', e.confidence, 'verificationMethod', e.verification_method,
      'contentHash', e.content_hash,
      'facts', jsonb_strip_nulls(jsonb_build_object(
        'companyName', e.structured_facts->>'companyName',
        'companyDomain', e.structured_facts->>'companyDomain',
        'employeeCount', e.structured_facts->'employeeCount',
        'technologies', e.structured_facts->'technologies',
        'location', e.structured_facts->'location',
        'problemCategory', e.structured_facts->'problem'->>'category',
        'problem', CASE WHEN jsonb_typeof(e.structured_facts->'problem')='object' THEN
          jsonb_strip_nulls(jsonb_build_object(
            'category', e.structured_facts->'problem'->>'category',
            'observedCondition', CASE WHEN char_length(btrim(e.structured_facts->'problem'->>'observedCondition')) BETWEEN 1 AND 500
              AND (e.structured_facts->'problem'->>'observedCondition') !~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
              AND (e.structured_facts->'problem'->>'observedCondition') !~* '(https?://|www\.)'
              AND (e.structured_facts->'problem'->>'observedCondition') !~ '(^|[^[:alnum:]_])@[A-Za-z0-9_]{2,}'
              AND (e.structured_facts->'problem'->>'observedCondition') !~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
              THEN btrim(e.structured_facts->'problem'->>'observedCondition') END
          )) END,
        'measurement', CASE WHEN e.structured_facts ? 'sourceMeasurement' THEN jsonb_build_object(
          'metric', e.structured_facts->'sourceMeasurement'->>'metric',
          'value', e.structured_facts->'sourceMeasurement'->'value',
          'observedAt', e.structured_facts->'sourceMeasurement'->'observedAt'
        ) END
      ))
    ) ORDER BY e.captured_at DESC, e.id), '[]'::jsonb)
    INTO v_evidence
    FROM public.intentlead_opportunity_evidence oe
    JOIN public.intentlead_evidence_items e ON e.id=oe.evidence_id AND e.workspace_id=oe.workspace_id
    LEFT JOIN public.intentlead_provider_runs r ON r.id=e.provider_run_id AND r.workspace_id=e.workspace_id
    LEFT JOIN public.intentlead_source_items s ON s.id=e.source_item_id AND s.workspace_id=e.workspace_id
    WHERE oe.workspace_id=v_row.workspace_id AND oe.opportunity_id=v_row.id
      AND oe.tombstoned_at IS NULL AND e.tombstoned_at IS NULL;
    v_result := v_result || jsonb_build_object('evidence', v_evidence, 'limitations', '[]'::jsonb);
  END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_list_opportunities_for_review(
  p_limit integer DEFAULT 20,
  p_after_created_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_row record; v_count integer := 0; v_rows jsonb := '[]'::jsonb; v_has_more boolean := false;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'invalid_page_size' USING ERRCODE='22023'; END IF;
  IF (p_after_created_at IS NULL) <> (p_after_id IS NULL) THEN RAISE EXCEPTION 'invalid_cursor' USING ERRCODE='22023'; END IF;
  FOR v_row IN
    SELECT o.id,o.created_at FROM public.intentlead_opportunities o
    JOIN public.intentlead_discovery_briefs b ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
    JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
    WHERE o.tombstoned_at IS NULL AND o.state IN ('HUMAN_REVIEW','REJECTED','NEEDS_RESEARCH')
      AND public.intentlead_is_workspace_member(o.workspace_id)
      AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
      AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
      AND NOT (m.capabilities && ARRAY[
        'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
        'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
      ]::text[])
      AND (p_after_created_at IS NULL OR (o.created_at,o.id)<(p_after_created_at,p_after_id))
    ORDER BY o.created_at DESC,o.id DESC LIMIT p_limit+1
  LOOP
    v_count := v_count+1;
    IF v_count>p_limit THEN v_has_more:=true; EXIT; END IF;
    v_rows := v_rows || jsonb_build_array(public.intentlead_build_opportunity_review_dto(v_row.id,false));
  END LOOP;
  RETURN jsonb_build_object('rows',v_rows,'hasMore',v_has_more);
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_get_opportunity_for_review(p_opportunity_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT public.intentlead_build_opportunity_review_dto(p_opportunity_id,true)
$$;

REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.intentlead_get_opportunity_for_review(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_opportunity_for_review(uuid) TO authenticated;
