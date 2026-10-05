-- Deletion and review share a workspace lock. A tombstone always wins over replay.
DO $$
BEGIN
  IF to_regprocedure('public.intentlead_delete_discovery_brief_task8_v3(uuid,uuid,text)') IS NULL
     AND to_regprocedure('public.intentlead_delete_discovery_brief(uuid,uuid,text)') IS NOT NULL THEN
    ALTER FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
      RENAME TO intentlead_delete_discovery_brief_task8_v3;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief_task8_v3(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_delete_discovery_brief(
  p_discovery_brief_id uuid, p_user_id uuid, p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.intentlead_delete_discovery_brief_task8_v3(p_discovery_brief_id,p_user_id,p_reason) THEN
    RETURN false;
  END IF;
  -- Keep the unique key as a tombstone, but never retain the note-bearing fingerprint.
  UPDATE public.intentlead_human_reviews r
  SET note=NULL,
      request_fingerprint=CASE WHEN r.idempotency_key IS NULL THEN NULL ELSE '[redacted]' END
  WHERE r.opportunity_id IN (
    SELECT o.id FROM public.intentlead_opportunities o
    WHERE o.discovery_brief_id=p_discovery_brief_id
  );
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_delete_discovery_brief(uuid,uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.intentlead_record_opportunity_review(
  p_opportunity_id uuid, p_decision text, p_reason text, p_note text, p_idempotency_key text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
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
  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_workspace::text,0));
  -- Serialize with owner deletion before checking any idempotency row.
  SELECT o.* INTO v_opportunity FROM public.intentlead_opportunities o
  WHERE o.id=p_opportunity_id AND o.workspace_id=v_workspace AND o.tombstoned_at IS NULL
    AND public.intentlead_is_workspace_member(o.workspace_id)
  FOR UPDATE OF o;
  IF NOT FOUND THEN RAISE EXCEPTION 'opportunity_not_found' USING ERRCODE='P0002'; END IF;

  v_fingerprint := jsonb_build_object('decision',p_decision,'reason',p_reason,'note',v_note)::text;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_workspace::text || ':' || p_idempotency_key,0));
  SELECT * INTO v_existing FROM public.intentlead_human_reviews
  WHERE workspace_id=v_workspace AND idempotency_key=p_idempotency_key;
  IF FOUND THEN
    IF v_existing.tombstoned_at IS NOT NULL
      OR v_existing.opportunity_id<>p_opportunity_id
      OR v_existing.request_fingerprint<>v_fingerprint
    THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
    v_state := CASE v_existing.decision WHEN 'ACCEPTED' THEN 'HUMAN_REVIEW' ELSE v_existing.decision END;
    RETURN jsonb_build_object('opportunityId',p_opportunity_id,'state',v_state,
      'decision',v_existing.decision,'reason',v_existing.reason,'reviewedAt',v_existing.reviewed_at,'replayed',true);
  END IF;

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
  ) VALUES (v_workspace,p_opportunity_id,v_user,p_decision,p_reason,v_note,v_reviewed_at,p_idempotency_key,v_fingerprint);
  v_state := CASE p_decision WHEN 'ACCEPTED' THEN 'HUMAN_REVIEW' ELSE p_decision END;
  IF p_decision<>'ACCEPTED' THEN
    UPDATE public.intentlead_opportunities SET state=v_state
    WHERE id=p_opportunity_id AND workspace_id=v_workspace AND tombstoned_at IS NULL;
  END IF;
  RETURN jsonb_build_object('opportunityId',p_opportunity_id,'state',v_state,
    'decision',p_decision,'reason',p_reason,'reviewedAt',v_reviewed_at,'replayed',false);
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.intentlead_record_opportunity_review(uuid,text,text,text,text) TO authenticated;
