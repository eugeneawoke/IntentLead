-- Deferred evidence integrity validation is invoked by the authenticated review RPC.
CREATE OR REPLACE FUNCTION public.intentlead_assert_opportunity_has_evidence()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_opportunity_id uuid;
BEGIN
  IF TG_TABLE_NAME='intentlead_opportunities' THEN
    v_opportunity_id := NEW.id;
  ELSE
    v_opportunity_id := OLD.opportunity_id;
  END IF;
  IF EXISTS (SELECT 1 FROM public.intentlead_opportunities WHERE id=v_opportunity_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence WHERE opportunity_id=v_opportunity_id
    )
  THEN RAISE EXCEPTION 'opportunity_requires_evidence'; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_assert_opportunity_has_evidence() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.intentlead_validate_opportunity_snapshot()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_assessment_opportunity uuid; v_market_profile_key text;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NULL; END IF;
  SELECT m.profile_key INTO v_market_profile_key
  FROM public.intentlead_discovery_briefs b
  JOIN public.intentlead_market_profiles m ON m.id=b.market_profile_id AND m.workspace_id=b.workspace_id
  WHERE b.id=NEW.discovery_brief_id AND b.workspace_id=NEW.workspace_id;
  IF v_market_profile_key IS NULL THEN RAISE EXCEPTION 'opportunity_market_profile_missing'; END IF;
  IF v_market_profile_key='EN_DISCOVERY_ONLY' AND NEW.state NOT IN (
    'DISCOVERED','ENRICHING','ASSESSABLE','INSUFFICIENT_EVIDENCE','PACKAGE_READY',
    'MODEL_REJECTED','HUMAN_REVIEW','REJECTED','NEEDS_RESEARCH'
  ) THEN RAISE EXCEPTION 'discovery_opportunity_state_denied'; END IF;
  IF NEW.state IN ('DISCOVERED','ENRICHING','INSUFFICIENT_EVIDENCE') THEN
    IF NEW.current_assessment_id IS NOT NULL THEN RAISE EXCEPTION 'incomplete_opportunity_has_assessment'; END IF;
  ELSIF NEW.state='ASSESSABLE' THEN
    IF NEW.company_id IS NULL OR NEW.current_assessment_id IS NOT NULL THEN RAISE EXCEPTION 'assessable_opportunity_reference_invalid'; END IF;
  ELSIF NEW.company_id IS NULL OR NEW.current_assessment_id IS NULL THEN
    RAISE EXCEPTION 'assessed_opportunity_references_required';
  END IF;
  IF NEW.current_assessment_id IS NOT NULL THEN
    SELECT opportunity_id INTO v_assessment_opportunity FROM public.intentlead_opportunity_assessments
    WHERE id=NEW.current_assessment_id AND workspace_id=NEW.workspace_id;
    IF v_assessment_opportunity IS DISTINCT FROM NEW.id THEN RAISE EXCEPTION 'assessment_opportunity_mismatch'; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_opportunity_snapshot() FROM PUBLIC, anon, authenticated, service_role;
