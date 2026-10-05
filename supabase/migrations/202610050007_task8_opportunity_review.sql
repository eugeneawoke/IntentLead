-- Task 8: authenticated discovery-only review reads and one atomic review command.
ALTER TABLE public.intentlead_human_reviews
  ADD COLUMN idempotency_key text,
  ADD COLUMN request_fingerprint text,
  ADD CONSTRAINT intentlead_review_idempotency_key_check CHECK (
    idempotency_key IS NULL OR idempotency_key ~ '^[A-Za-z0-9._:-]{12,128}$'
  ),
  ADD CONSTRAINT intentlead_review_fingerprint_pair_check CHECK (
    (idempotency_key IS NULL) = (request_fingerprint IS NULL)
    AND (request_fingerprint IS NULL OR length(request_fingerprint) BETWEEN 1 AND 1000)
  );
CREATE UNIQUE INDEX intentlead_review_workspace_idempotency_uq
  ON public.intentlead_human_reviews(workspace_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

DROP POLICY IF EXISTS intentlead_member_review_insert ON public.intentlead_human_reviews;
REVOKE INSERT ON TABLE public.intentlead_human_reviews FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_build_opportunity_review_dto(
  p_opportunity_id uuid,
  p_include_evidence boolean
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
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
    a.commercial_impact, a.icp_fit, a.actionability,
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
    'id', v_row.id,
    'state', v_row.state,
    'signal', v_row.signal,
    'company', CASE WHEN v_row.company_name IS NULL THEN NULL ELSE jsonb_build_object(
      'name', v_row.company_name, 'domain', v_row.company_domain, 'confidence', v_row.company_confidence
    ) END,
    'assessment', CASE WHEN v_row.assessment_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision', v_row.assessment_decision, 'confidence', v_row.assessment_confidence,
      'evidenceStrength', v_row.evidence_strength, 'freshness', v_row.freshness,
      'commercialImpact', v_row.commercial_impact, 'icpFit', v_row.icp_fit,
      'actionability', v_row.actionability
    ) END,
    'evidenceCount', v_active,
    'evidenceStatus', CASE WHEN v_active=0 THEN 'MISSING' WHEN v_active<v_total THEN 'PARTIAL' ELSE 'COMPLETE' END,
    'latestReview', CASE WHEN v_row.latest_decision IS NULL THEN NULL ELSE jsonb_build_object(
      'decision', v_row.latest_decision, 'reviewedAt', v_row.latest_reviewed_at
    ) END,
    'createdAt', v_row.created_at,
    'updatedAt', v_row.updated_at
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
REVOKE ALL ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_build_opportunity_review_dto(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.intentlead_list_opportunities_for_review(
  p_limit integer DEFAULT 20,
  p_after_created_at timestamptz DEFAULT NULL,
  p_after_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_row record;
  v_count integer := 0;
  v_rows jsonb := '[]'::jsonb;
  v_has_more boolean := false;
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'invalid_page_size' USING ERRCODE='22023'; END IF;
  IF (p_after_created_at IS NULL) <> (p_after_id IS NULL) THEN RAISE EXCEPTION 'invalid_cursor' USING ERRCODE='22023'; END IF;
  FOR v_row IN
    SELECT o.id,o.created_at FROM public.intentlead_opportunities o
    JOIN public.intentlead_discovery_briefs b ON b.id=o.discovery_brief_id AND b.workspace_id=o.workspace_id
    JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
    WHERE o.tombstoned_at IS NULL AND o.state IN ('HUMAN_REVIEW','REJECTED','NEEDS_RESEARCH')
      AND m.profile_key='EN_DISCOVERY_ONLY' AND m.workflow='DISCOVERY_ONLY'
      AND m.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
      AND NOT (m.capabilities && ARRAY[
        'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
        'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
      ]::text[])
      AND (p_after_created_at IS NULL OR (o.created_at,o.id)<(p_after_created_at,p_after_id))
    ORDER BY o.created_at DESC,o.id DESC
    LIMIT p_limit+1
  LOOP
    v_count := v_count+1;
    IF v_count>p_limit THEN v_has_more:=true; EXIT; END IF;
    v_rows := v_rows || jsonb_build_array(public.intentlead_build_opportunity_review_dto(v_row.id,false));
  END LOOP;
  RETURN jsonb_build_object('rows',v_rows,'hasMore',v_has_more);
END;
$$;

CREATE OR REPLACE FUNCTION public.intentlead_get_opportunity_for_review(p_opportunity_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT public.intentlead_build_opportunity_review_dto(p_opportunity_id,true)
$$;

CREATE OR REPLACE FUNCTION public.intentlead_record_opportunity_review(
  p_opportunity_id uuid,
  p_decision text,
  p_reason text,
  p_note text,
  p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_workspace uuid;
  v_opportunity public.intentlead_opportunities%ROWTYPE;
  v_profile public.intentlead_market_profiles%ROWTYPE;
  v_existing public.intentlead_human_reviews%ROWTYPE;
  v_note text := nullif(btrim(p_note),'');
  v_fingerprint text;
  v_reviewed_at timestamptz;
  v_state text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE='28000'; END IF;
  IF p_opportunity_id IS NULL OR p_idempotency_key IS NULL
    OR p_idempotency_key !~ '^[A-Za-z0-9._:-]{12,128}$'
    OR p_decision NOT IN ('ACCEPTED','REJECTED','NEEDS_RESEARCH')
    OR p_reason IS NULL OR length(p_reason)>80 THEN RAISE EXCEPTION 'invalid_review_command' USING ERRCODE='22023'; END IF;
  IF (p_decision='ACCEPTED' AND p_reason<>'RELEVANT')
    OR (p_decision<>'ACCEPTED' AND p_reason NOT IN (
      'WRONG_COMPANY','WEAK_SIGNAL','NOT_RELEVANT','TOO_OLD','ALREADY_SOLVED','DUPLICATE','POLICY_CONCERN','OTHER'
    )) OR (p_reason='OTHER' AND v_note IS NULL)
  THEN RAISE EXCEPTION 'invalid_review_reason' USING ERRCODE='22023'; END IF;
  IF p_note IS NOT NULL AND (length(v_note)>500
    OR v_note ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}'
    OR v_note ~* '(https?://|www\.)'
    OR v_note ~ '(^|[^[:alnum:]_])@[A-Za-z0-9_]{2,}'
    OR v_note ~ '(^|[^0-9])\+?[0-9][0-9(). -]{7,}[0-9]([^0-9]|$)'
  ) THEN RAISE EXCEPTION 'invalid_review_note' USING ERRCODE='22023'; END IF;

  SELECT o.workspace_id INTO v_workspace FROM public.intentlead_opportunities o
  WHERE o.id=p_opportunity_id AND public.intentlead_is_workspace_member(o.workspace_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;
  v_fingerprint := jsonb_build_object('decision',p_decision,'reason',p_reason,'note',v_note)::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_workspace::text || ':' || p_idempotency_key,0));
  SELECT * INTO v_existing FROM public.intentlead_human_reviews
  WHERE workspace_id=v_workspace AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.opportunity_id<>p_opportunity_id OR v_existing.request_fingerprint<>v_fingerprint
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    v_state := CASE v_existing.decision WHEN 'ACCEPTED' THEN 'HUMAN_REVIEW' ELSE v_existing.decision END;
    RETURN jsonb_build_object('opportunityId',p_opportunity_id,'state',v_state,
      'decision',v_existing.decision,'reason',v_existing.reason,'reviewedAt',v_existing.reviewed_at,'replayed',true);
  END IF;

  SELECT * INTO v_opportunity FROM public.intentlead_opportunities
  WHERE id=p_opportunity_id AND workspace_id=v_workspace FOR UPDATE;
  IF NOT FOUND OR v_opportunity.tombstoned_at IS NOT NULL THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;
  IF v_opportunity.state<>'HUMAN_REVIEW' OR EXISTS (
    SELECT 1 FROM public.intentlead_human_reviews r
    WHERE r.workspace_id=v_workspace AND r.opportunity_id=p_opportunity_id AND r.tombstoned_at IS NULL
  ) THEN RAISE EXCEPTION 'stale_opportunity' USING ERRCODE='40001'; END IF;
  SELECT m.* INTO v_profile FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=v_opportunity.discovery_brief_id AND b.workspace_id=v_workspace FOR SHARE OF b,m;
  IF NOT FOUND OR v_profile.profile_key<>'EN_DISCOVERY_ONLY' OR v_profile.workflow<>'DISCOVERY_ONLY'
    OR NOT v_profile.capabilities @> ARRAY['HUMAN_REVIEW']::text[]
    OR v_profile.capabilities && ARRAY[
      'PEOPLE_SEARCH','CONTACT_ENRICHMENT','EMAIL_FIND','EMAIL_VERIFY','DRAFT_GENERATION',
      'OUTREACH_READY','OUTREACH_SEND','OUTCOME_RECORDING','PACKAGE_VERIFIED'
    ]::text[]
  THEN RAISE EXCEPTION 'policy_denied' USING ERRCODE='42501'; END IF;

  v_reviewed_at := clock_timestamp();
  INSERT INTO public.intentlead_human_reviews(
    workspace_id,opportunity_id,reviewer_id,decision,reason,note,reviewed_at,idempotency_key,request_fingerprint
  ) VALUES (
    v_workspace,p_opportunity_id,v_user,p_decision,p_reason,v_note,v_reviewed_at,p_idempotency_key,v_fingerprint
  );
  v_state := CASE p_decision WHEN 'ACCEPTED' THEN 'HUMAN_REVIEW' ELSE p_decision END;
  IF p_decision<>'ACCEPTED' THEN
    UPDATE public.intentlead_opportunities SET state=v_state WHERE id=p_opportunity_id AND workspace_id=v_workspace;
  END IF;
  RETURN jsonb_build_object('opportunityId',p_opportunity_id,'state',v_state,
    'decision',p_decision,'reason',p_reason,'reviewedAt',v_reviewed_at,'replayed',false);
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.intentlead_get_opportunity_for_review(uuid) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_list_opportunities_for_review(integer,timestamptz,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_get_opportunity_for_review(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text) TO authenticated;
