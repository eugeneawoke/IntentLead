-- Task I: provenance, suppression, grounding and deletion guards for the package graph.

CREATE OR REPLACE FUNCTION public.intentlead_contact_value_hash(p_channel text,p_value text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = pg_catalog, public AS $$
  SELECT encode(digest(CASE WHEN p_channel IN ('email','profile') THEN lower(btrim(p_value)) ELSE regexp_replace(p_value,'[[:space:]]','','g') END,'sha256'),'hex')
$$;
REVOKE ALL ON FUNCTION public.intentlead_contact_value_hash(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_contact_value_hash(text,text) TO service_role;

CREATE OR REPLACE FUNCTION public.intentlead_validate_contact_point()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_identifier_type text; v_suppression_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text||':'||NEW.channel||':'||NEW.value_hash,0));
  IF NEW.state='AVAILABLE' THEN
    IF NEW.value_hash<>public.intentlead_contact_value_hash(NEW.channel,NEW.value) THEN RAISE EXCEPTION 'contact_value_hash_mismatch'; END IF;
    IF (NEW.channel='email' AND NEW.value!~*'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')
      OR (NEW.channel='phone' AND NEW.value!~'^\+[1-9][0-9]{6,14}$')
      OR (NEW.channel='profile' AND NEW.value!~*'^https?://') THEN RAISE EXCEPTION 'invalid_contact_value'; END IF;
    v_identifier_type:=upper(NEW.channel);
    SELECT id INTO v_suppression_id FROM public.intentlead_suppression_entries
    WHERE workspace_id=NEW.workspace_id AND identifier_type=v_identifier_type AND identifier_hash=NEW.value_hash
      AND (retain_until IS NULL OR retain_until>clock_timestamp()) LIMIT 1;
    IF v_suppression_id IS NOT NULL THEN RAISE EXCEPTION 'contact_suppressed'; END IF;
  ELSIF NEW.state='SUPPRESSED' THEN
    SELECT id INTO v_suppression_id FROM public.intentlead_suppression_entries
    WHERE id=NEW.suppression_entry_id AND workspace_id=NEW.workspace_id
      AND identifier_type=upper(NEW.channel) AND identifier_hash=NEW.value_hash
      AND (retain_until IS NULL OR retain_until>clock_timestamp());
    IF v_suppression_id IS NULL THEN RAISE EXCEPTION 'contact_suppression_mismatch'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_contact_point() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_contact_point_valid
  BEFORE INSERT OR UPDATE ON public.intentlead_contact_points
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_contact_point();

CREATE OR REPLACE FUNCTION public.intentlead_lock_suppression_key()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP='UPDATE' AND (OLD.identifier_type,OLD.identifier_hash) IS DISTINCT FROM (NEW.identifier_type,NEW.identifier_hash) THEN
    RAISE EXCEPTION 'suppression_identity_immutable';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.workspace_id::text||':'||lower(NEW.identifier_type)||':'||NEW.identifier_hash,0));
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_lock_suppression_key() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_suppression_key_lock
  BEFORE INSERT OR UPDATE OF identifier_type,identifier_hash,retain_until ON public.intentlead_suppression_entries
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_lock_suppression_key();

CREATE OR REPLACE FUNCTION public.intentlead_apply_suppression()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.identifier_type IN ('EMAIL','PHONE','PROFILE') AND (NEW.retain_until IS NULL OR NEW.retain_until>clock_timestamp()) THEN
    UPDATE public.intentlead_contact_points SET value=NULL,state='SUPPRESSED',suppression_entry_id=NEW.id,updated_at=clock_timestamp()
    WHERE workspace_id=NEW.workspace_id AND channel=lower(NEW.identifier_type) AND value_hash=NEW.identifier_hash AND state='AVAILABLE';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_apply_suppression() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_suppression_applied
  AFTER INSERT OR UPDATE OF identifier_type,identifier_hash,retain_until ON public.intentlead_suppression_entries
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_apply_suppression();

CREATE OR REPLACE FUNCTION public.intentlead_validate_contact_verification()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NEW; END IF;
  IF NEW.checked_at>clock_timestamp() THEN RAISE EXCEPTION 'contact_verification_in_future'; END IF;
  IF NEW.status='VALID' AND (NEW.expires_at IS NULL OR NEW.expires_at<clock_timestamp()) THEN
    RAISE EXCEPTION 'valid_contact_verification_requires_current_expiry';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_contact_verification() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_contact_verification_valid
  BEFORE INSERT OR UPDATE ON public.intentlead_contact_verifications
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_contact_verification();

CREATE OR REPLACE FUNCTION public.intentlead_validate_conversation_brief_contact()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_valid boolean;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.intentlead_contact_points cp
    JOIN public.intentlead_contact_verifications cv
      ON cv.workspace_id=cp.workspace_id AND cv.opportunity_id=cp.opportunity_id AND cv.contact_point_id=cp.id
    JOIN public.intentlead_buyer_candidates bc
      ON bc.workspace_id=cp.workspace_id AND bc.opportunity_id=cp.opportunity_id AND bc.id=NEW.buyer_candidate_id
    WHERE cp.workspace_id=NEW.workspace_id AND cp.opportunity_id=NEW.opportunity_id
      AND cp.id=NEW.contact_point_id AND cp.state='AVAILABLE' AND cp.tombstoned_at IS NULL
      AND cv.id=NEW.contact_verification_id AND cv.status='VALID' AND cv.tombstoned_at IS NULL
      AND cv.checked_at<=clock_timestamp() AND cv.expires_at>=clock_timestamp()
      AND bc.tombstoned_at IS NULL
      AND (cp.scope='COMPANY' OR (cp.scope='PERSON' AND bc.person_id IS NOT NULL AND bc.person_id=cp.person_id))
  ) INTO v_valid;
  IF NOT v_valid THEN RAISE EXCEPTION 'conversation_brief_requires_current_verified_contact'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_conversation_brief_contact() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_conversation_brief_contact_valid
  BEFORE INSERT OR UPDATE ON public.intentlead_conversation_briefs
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_conversation_brief_contact();

CREATE OR REPLACE FUNCTION public.intentlead_protect_package_binding()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_referenced boolean;
BEGIN
  IF TG_TABLE_NAME='intentlead_buyer_candidates' THEN
    SELECT EXISTS(SELECT 1 FROM public.intentlead_conversation_briefs b WHERE b.buyer_candidate_id=OLD.id AND b.tombstoned_at IS NULL) INTO v_referenced;
    IF v_referenced AND (NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id) THEN
      RAISE EXCEPTION 'referenced_buyer_binding_is_immutable';
    END IF;
  ELSIF TG_TABLE_NAME='intentlead_contact_points' THEN
    SELECT EXISTS(SELECT 1 FROM public.intentlead_conversation_briefs b WHERE b.contact_point_id=OLD.id AND b.tombstoned_at IS NULL) INTO v_referenced;
    IF v_referenced AND (NEW.person_id IS DISTINCT FROM OLD.person_id OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id) THEN
      RAISE EXCEPTION 'referenced_contact_binding_is_immutable';
    END IF;
  ELSE
    SELECT EXISTS(SELECT 1 FROM public.intentlead_conversation_briefs b WHERE b.contact_verification_id=OLD.id AND b.tombstoned_at IS NULL) INTO v_referenced;
    IF v_referenced AND (NEW.contact_point_id IS DISTINCT FROM OLD.contact_point_id OR NEW.opportunity_id IS DISTINCT FROM OLD.opportunity_id
      OR NEW.checked_at IS DISTINCT FROM OLD.checked_at OR NEW.expires_at IS DISTINCT FROM OLD.expires_at) THEN
      RAISE EXCEPTION 'referenced_verification_binding_is_immutable';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_protect_package_binding() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_buyer_binding_immutable BEFORE UPDATE ON public.intentlead_buyer_candidates
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_protect_package_binding();
CREATE TRIGGER intentlead_contact_binding_immutable BEFORE UPDATE ON public.intentlead_contact_points
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_protect_package_binding();
CREATE TRIGGER intentlead_verification_binding_immutable BEFORE UPDATE ON public.intentlead_contact_verifications
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_protect_package_binding();

CREATE OR REPLACE FUNCTION public.intentlead_invalidate_dependent_package()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_TABLE_NAME='intentlead_contact_points' AND (to_jsonb(NEW)->>'state'<>'AVAILABLE' OR NEW.tombstoned_at IS NOT NULL) THEN
    UPDATE public.intentlead_conversation_briefs SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp())
    WHERE contact_point_id=NEW.id AND tombstoned_at IS NULL;
    UPDATE public.intentlead_drafts SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp()),updated_at=clock_timestamp()
    WHERE conversation_brief_id IN (SELECT id FROM public.intentlead_conversation_briefs WHERE contact_point_id=NEW.id);
  ELSIF TG_TABLE_NAME='intentlead_contact_verifications' AND (to_jsonb(NEW)->>'status'<>'VALID' OR NEW.tombstoned_at IS NOT NULL) THEN
    UPDATE public.intentlead_conversation_briefs SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp())
    WHERE contact_verification_id=NEW.id AND tombstoned_at IS NULL;
    UPDATE public.intentlead_drafts SET tombstoned_at=coalesce(tombstoned_at,clock_timestamp()),updated_at=clock_timestamp()
    WHERE conversation_brief_id IN (SELECT id FROM public.intentlead_conversation_briefs WHERE contact_verification_id=NEW.id);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_invalidate_dependent_package() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_contact_invalidates_package AFTER UPDATE OF state,tombstoned_at ON public.intentlead_contact_points
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_invalidate_dependent_package();
CREATE TRIGGER intentlead_verification_invalidates_package AFTER UPDATE OF status,tombstoned_at ON public.intentlead_contact_verifications
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_invalidate_dependent_package();

CREATE OR REPLACE FUNCTION public.intentlead_validate_draft_package()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_valid boolean;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT EXISTS(
    SELECT 1 FROM public.intentlead_conversation_briefs b
    JOIN public.intentlead_contact_points cp ON cp.id=b.contact_point_id AND cp.workspace_id=b.workspace_id AND cp.opportunity_id=b.opportunity_id
    JOIN public.intentlead_contact_verifications cv ON cv.id=b.contact_verification_id AND cv.workspace_id=b.workspace_id
      AND cv.opportunity_id=b.opportunity_id AND cv.contact_point_id=cp.id
    JOIN public.intentlead_buyer_candidates bc ON bc.id=b.buyer_candidate_id AND bc.workspace_id=b.workspace_id AND bc.opportunity_id=b.opportunity_id
    WHERE b.id=NEW.conversation_brief_id AND b.workspace_id=NEW.workspace_id AND b.opportunity_id=NEW.opportunity_id
      AND b.tombstoned_at IS NULL AND cp.state='AVAILABLE' AND cp.tombstoned_at IS NULL
      AND cv.status='VALID' AND cv.tombstoned_at IS NULL AND cv.checked_at<=clock_timestamp() AND cv.expires_at>=clock_timestamp()
      AND bc.tombstoned_at IS NULL AND (cp.scope='COMPANY' OR (cp.scope='PERSON' AND bc.person_id IS NOT NULL AND bc.person_id=cp.person_id))
  ) INTO v_valid;
  IF NOT v_valid THEN RAISE EXCEPTION 'draft_requires_current_verified_package'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_draft_package() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_draft_package_valid BEFORE INSERT OR UPDATE ON public.intentlead_drafts
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_draft_package();

CREATE OR REPLACE FUNCTION public.intentlead_validate_package_company()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_company_id uuid;
BEGIN
  IF NEW.tombstoned_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT company_id INTO v_company_id FROM public.intentlead_opportunities
  WHERE id=NEW.opportunity_id AND workspace_id=NEW.workspace_id AND tombstoned_at IS NULL;
  IF v_company_id IS NULL OR v_company_id IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'package_company_mismatch'; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_validate_package_company() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_person_company_valid BEFORE INSERT OR UPDATE ON public.intentlead_people
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_package_company();
CREATE TRIGGER intentlead_buyer_company_valid BEFORE INSERT OR UPDATE ON public.intentlead_buyer_candidates
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_package_company();
CREATE TRIGGER intentlead_contact_company_valid BEFORE INSERT OR UPDATE ON public.intentlead_contact_points
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_validate_package_company();

CREATE OR REPLACE FUNCTION public.intentlead_assert_package_evidence()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_entity_table text; v_link_table text; v_fk text; v_entity_id uuid; v_entity_live boolean; v_has_evidence boolean;
BEGIN
  CASE TG_TABLE_NAME
    WHEN 'intentlead_people' THEN v_entity_table:='intentlead_people';v_link_table:='intentlead_person_evidence';v_fk:='person_id';
    WHEN 'intentlead_person_evidence' THEN v_entity_table:='intentlead_people';v_link_table:='intentlead_person_evidence';v_fk:='person_id';
    WHEN 'intentlead_buyer_candidates' THEN v_entity_table:='intentlead_buyer_candidates';v_link_table:='intentlead_buyer_candidate_evidence';v_fk:='buyer_candidate_id';
    WHEN 'intentlead_buyer_candidate_evidence' THEN v_entity_table:='intentlead_buyer_candidates';v_link_table:='intentlead_buyer_candidate_evidence';v_fk:='buyer_candidate_id';
    WHEN 'intentlead_contact_points' THEN v_entity_table:='intentlead_contact_points';v_link_table:='intentlead_contact_point_evidence';v_fk:='contact_point_id';
    WHEN 'intentlead_contact_point_evidence' THEN v_entity_table:='intentlead_contact_points';v_link_table:='intentlead_contact_point_evidence';v_fk:='contact_point_id';
    WHEN 'intentlead_contact_verifications' THEN v_entity_table:='intentlead_contact_verifications';v_link_table:='intentlead_contact_verification_evidence';v_fk:='contact_verification_id';
    WHEN 'intentlead_contact_verification_evidence' THEN v_entity_table:='intentlead_contact_verifications';v_link_table:='intentlead_contact_verification_evidence';v_fk:='contact_verification_id';
    WHEN 'intentlead_conversation_brief_claims' THEN v_entity_table:='intentlead_conversation_brief_claims';v_link_table:='intentlead_conversation_brief_claim_evidence';v_fk:='claim_id';
    WHEN 'intentlead_conversation_brief_claim_evidence' THEN v_entity_table:='intentlead_conversation_brief_claims';v_link_table:='intentlead_conversation_brief_claim_evidence';v_fk:='claim_id';
    WHEN 'intentlead_draft_claims' THEN v_entity_table:='intentlead_draft_claims';v_link_table:='intentlead_draft_claim_evidence';v_fk:='claim_id';
    WHEN 'intentlead_draft_claim_evidence' THEN v_entity_table:='intentlead_draft_claims';v_link_table:='intentlead_draft_claim_evidence';v_fk:='claim_id';
    ELSE RAISE EXCEPTION 'unknown_package_evidence_table';
  END CASE;
  IF TG_TABLE_NAME=v_entity_table THEN v_entity_id:=(to_jsonb(NEW)->>'id')::uuid;
  ELSE v_entity_id:=(to_jsonb(OLD)->>v_fk)::uuid; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND tombstoned_at IS NULL)',v_entity_table) INTO v_entity_live USING v_entity_id;
  IF v_entity_live THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1)',v_link_table,v_fk) INTO v_has_evidence USING v_entity_id;
    IF NOT v_has_evidence THEN RAISE EXCEPTION 'package_record_requires_evidence:%',v_entity_table; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_assert_package_evidence() FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE v_pair text[]; BEGIN FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
  ['intentlead_people','intentlead_person_evidence'],['intentlead_buyer_candidates','intentlead_buyer_candidate_evidence'],
  ['intentlead_contact_points','intentlead_contact_point_evidence'],['intentlead_contact_verifications','intentlead_contact_verification_evidence'],
  ['intentlead_conversation_brief_claims','intentlead_conversation_brief_claim_evidence'],['intentlead_draft_claims','intentlead_draft_claim_evidence']
] LOOP
  EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER INSERT OR UPDATE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_evidence()',v_pair[1]||'_requires_evidence',v_pair[1]);
  EXECUTE format('CREATE CONSTRAINT TRIGGER %I AFTER DELETE OR UPDATE ON public.%I DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_evidence()',v_pair[1]||'_preserves_evidence',v_pair[2]);
END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.intentlead_assert_package_claims()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_parent_table text; v_claim_table text; v_fk text; v_parent_id uuid; v_parent_live boolean; v_has_claim boolean;
BEGIN
  IF TG_TABLE_NAME IN ('intentlead_conversation_briefs','intentlead_conversation_brief_claims') THEN
    v_parent_table:='intentlead_conversation_briefs';v_claim_table:='intentlead_conversation_brief_claims';v_fk:='brief_id';
  ELSE v_parent_table:='intentlead_drafts';v_claim_table:='intentlead_draft_claims';v_fk:='draft_id'; END IF;
  IF TG_TABLE_NAME=v_parent_table THEN v_parent_id:=(to_jsonb(NEW)->>'id')::uuid;
  ELSE v_parent_id:=(to_jsonb(OLD)->>v_fk)::uuid; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE id=$1 AND tombstoned_at IS NULL)',v_parent_table) INTO v_parent_live USING v_parent_id;
  IF v_parent_live THEN
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1 AND tombstoned_at IS NULL)',v_claim_table,v_fk) INTO v_has_claim USING v_parent_id;
    IF NOT v_has_claim THEN RAISE EXCEPTION 'package_record_requires_grounded_claim:%',v_parent_table; END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_assert_package_claims() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER intentlead_brief_requires_claim AFTER INSERT OR UPDATE ON public.intentlead_conversation_briefs
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_claims();
CREATE CONSTRAINT TRIGGER intentlead_brief_preserves_claim AFTER DELETE OR UPDATE ON public.intentlead_conversation_brief_claims
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_claims();
CREATE CONSTRAINT TRIGGER intentlead_draft_requires_claim AFTER INSERT OR UPDATE ON public.intentlead_drafts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_claims();
CREATE CONSTRAINT TRIGGER intentlead_draft_preserves_claim AFTER DELETE OR UPDATE ON public.intentlead_draft_claims
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_package_claims();

CREATE OR REPLACE FUNCTION public.intentlead_assert_draft_claim_coverage()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE v_draft_id uuid; v_draft_ids uuid[]; v_body text; v_subject text; v_live boolean; v_target text; v_text text;
  v_expected_offset integer; v_claim record;
BEGIN
  IF TG_TABLE_NAME='intentlead_drafts' THEN
    v_draft_ids:=ARRAY[(to_jsonb(NEW)->>'id')::uuid];
  ELSE
    v_draft_ids:=ARRAY(SELECT DISTINCT value FROM unnest(ARRAY[
      (to_jsonb(OLD)->>'draft_id')::uuid,(to_jsonb(NEW)->>'draft_id')::uuid
    ]) value WHERE value IS NOT NULL);
  END IF;
  FOREACH v_draft_id IN ARRAY v_draft_ids LOOP
    SELECT body,subject,tombstoned_at IS NULL INTO v_body,v_subject,v_live
    FROM public.intentlead_drafts WHERE id=v_draft_id;
    IF NOT coalesce(v_live,false) THEN CONTINUE; END IF;
    FOREACH v_target IN ARRAY ARRAY['BODY','SUBJECT'] LOOP
      v_text:=CASE WHEN v_target='BODY' THEN v_body ELSE v_subject END;
      v_expected_offset:=0;
      FOR v_claim IN
        SELECT start_offset,end_offset,claim_text FROM public.intentlead_draft_claims
        WHERE draft_id=v_draft_id AND target=v_target AND tombstoned_at IS NULL
        ORDER BY start_offset,id
      LOOP
        IF v_text IS NULL OR v_claim.start_offset<>v_expected_offset OR v_claim.end_offset>length(v_text)
          OR substr(v_text,v_claim.start_offset+1,v_claim.end_offset-v_claim.start_offset)<>v_claim.claim_text THEN
          RAISE EXCEPTION 'draft_contains_ungrounded_text:%',lower(v_target);
        END IF;
        v_expected_offset:=v_claim.end_offset;
      END LOOP;
      IF (v_text IS NULL AND v_expected_offset<>0) OR (v_text IS NOT NULL AND v_expected_offset<>length(v_text)) THEN
        RAISE EXCEPTION 'draft_contains_ungrounded_text:%',lower(v_target);
      END IF;
    END LOOP;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_assert_draft_claim_coverage() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER intentlead_draft_claim_coverage AFTER INSERT OR UPDATE ON public.intentlead_drafts
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_draft_claim_coverage();
CREATE CONSTRAINT TRIGGER intentlead_draft_claims_preserve_coverage AFTER INSERT OR UPDATE OR DELETE ON public.intentlead_draft_claims
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.intentlead_assert_draft_claim_coverage();

CREATE OR REPLACE FUNCTION public.intentlead_redact_opportunity_package()
RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF OLD.tombstoned_at IS NULL AND NEW.tombstoned_at IS NOT NULL THEN
    UPDATE public.intentlead_people SET full_name='[deleted]',role_title=NULL,tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at),updated_at=clock_timestamp() WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_buyer_candidates SET role_title='[deleted]',hypothesis='[deleted]',tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at) WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_contact_verifications SET tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at) WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_contact_points SET value=NULL,value_hash=encode(digest(id::text||':deleted','sha256'),'hex'),state='DELETED',source_kind='USER_PROVIDED',source_url=NULL,source_provider_run_id=NULL,suppression_entry_id=NULL,tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at),updated_at=clock_timestamp() WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_conversation_brief_claims SET claim_text='[deleted]',tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at) WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_conversation_briefs SET problem_summary='[deleted]',relevance_summary='[deleted]',recommended_angle='[deleted]',low_friction_cta='[deleted]',tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at) WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_draft_claims SET claim_text='[deleted]',tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at) WHERE opportunity_id=NEW.id;
    UPDATE public.intentlead_drafts SET subject=NULL,body='[deleted]',tombstoned_at=coalesce(tombstoned_at,NEW.tombstoned_at),updated_at=clock_timestamp() WHERE opportunity_id=NEW.id;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_redact_opportunity_package() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER intentlead_opportunity_package_redaction
  AFTER UPDATE OF tombstoned_at ON public.intentlead_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.intentlead_redact_opportunity_package();
