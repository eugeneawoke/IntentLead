-- Task 5: owner-authorized, shared-safe deletion for discovery briefs and durable work.
-- Suppression entries are deliberately retained as the minimum policy-protection record.

CREATE OR REPLACE FUNCTION public.intentlead_delete_discovery_brief(
  p_discovery_brief_id uuid,
  p_user_id uuid,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_workspace_id uuid;
  v_campaign_id uuid;
  v_opportunity_id uuid;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' OR length(p_reason) > 200 THEN
    RAISE EXCEPTION 'invalid_deletion_reason';
  END IF;

  SELECT b.workspace_id INTO v_workspace_id
  FROM public.intentlead_discovery_briefs b
  WHERE b.id = p_discovery_brief_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('intentlead-workspace:' || v_workspace_id::text, 0));
  PERFORM 1 FROM public.workspaces
  WHERE id = v_workspace_id AND owner_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;
  PERFORM 1 FROM public.intentlead_discovery_briefs
  WHERE id = p_discovery_brief_id AND workspace_id = v_workspace_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  -- Stop dispatch/recovery first and scrub any stored execution material. Keep the
  -- durable row and identity fields as a minimal idempotency/audit tombstone.
  UPDATE public.intentlead_jobs
  SET state = CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN 'CANCELLED' ELSE state END,
      cancellation_requested_at = CASE
        WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN coalesce(cancellation_requested_at, clock_timestamp())
        ELSE cancellation_requested_at END,
      cancelled_at = CASE
        WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN coalesce(cancelled_at, clock_timestamp())
        ELSE cancelled_at END,
      lease_owner = NULL, lease_token = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
      completion_token = CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_token END,
      completion_worker = CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_worker END,
      completion_fingerprint = CASE WHEN state IN ('QUEUED','LEASED','RUNNING','RETRY_WAIT') THEN NULL ELSE completion_fingerprint END,
      payload = '{}'::jsonb, checkpoint = '{}'::jsonb, result = NULL, error = NULL, cost_scope = '{}'::jsonb
  WHERE discovery_brief_id = p_discovery_brief_id;

  UPDATE public.intentlead_job_step_attempts a
  SET state = CASE WHEN state = 'STARTED' THEN 'CANCELLED' ELSE state END,
      finished_at = CASE WHEN state = 'STARTED' THEN clock_timestamp() ELSE finished_at END,
      retry_reason = NULL, checkpoint = '{}'::jsonb, cost_scope = '{}'::jsonb
  WHERE a.job_id IN (
    SELECT j.id FROM public.intentlead_jobs j WHERE j.discovery_brief_id = p_discovery_brief_id
  );

  DELETE FROM public.intentlead_job_step_provider_runs link
  WHERE link.step_attempt_id IN (
    SELECT a.id FROM public.intentlead_job_step_attempts a
    JOIN public.intentlead_jobs j ON j.id = a.job_id
    WHERE j.discovery_brief_id = p_discovery_brief_id
  );

  UPDATE public.intentlead_provider_runs pr
  SET provider = 'redacted', provider_version = NULL,
      status = CASE WHEN status = 'STARTED' THEN 'FAILED' ELSE status END,
      request_metadata = '{}'::jsonb, response_metadata = '{}'::jsonb,
      latency_ms = NULL, usage_units = 0, cost_amount = 0, currency = NULL,
      finished_at = coalesce(finished_at, clock_timestamp())
  WHERE pr.job_id IN (
    SELECT j.id FROM public.intentlead_jobs j WHERE j.discovery_brief_id = p_discovery_brief_id
  )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      JOIN public.intentlead_opportunity_evidence live_link ON live_link.evidence_id = e.id
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_link.opportunity_id
      WHERE e.provider_run_id = pr.id AND live_link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_source_items s
      JOIN public.intentlead_evidence_items e ON e.source_item_id = s.id
      JOIN public.intentlead_opportunity_evidence live_link ON live_link.evidence_id = e.id
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_link.opportunity_id
      WHERE s.provider_run_id = pr.id AND live_link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    );

  SELECT legacy_campaign_id INTO v_campaign_id
  FROM public.intentlead_discovery_briefs WHERE id = p_discovery_brief_id;
  UPDATE public.campaigns SET status = 'error', updated_at = clock_timestamp()
  WHERE id = v_campaign_id AND workspace_id = v_workspace_id AND status = 'running';

  UPDATE public.intentlead_discovery_briefs
  SET state = 'CANCELLED', objective = '[deleted]', criteria = '{}'::jsonb
  WHERE id = p_discovery_brief_id AND workspace_id = v_workspace_id;

  FOR v_opportunity_id IN
    SELECT o.id FROM public.intentlead_opportunities o
    WHERE o.workspace_id = v_workspace_id AND o.discovery_brief_id = p_discovery_brief_id
    ORDER BY o.id
  LOOP
    PERFORM public.intentlead_tombstone_opportunity(v_opportunity_id, p_user_id, p_reason);
  END LOOP;

  -- Redact company/person/contact data only when no other live Opportunity uses it.
  UPDATE public.intentlead_companies c
  SET canonical_name = '[deleted]', domain = NULL, jurisdiction = NULL,
      tombstoned_at = coalesce(c.tombstoned_at, clock_timestamp())
  WHERE c.workspace_id = v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_opportunities own_o
      WHERE own_o.discovery_brief_id = p_discovery_brief_id AND own_o.company_id = c.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunities live_o
      WHERE live_o.company_id = c.id AND live_o.tombstoned_at IS NULL
    );

  UPDATE public.intentlead_people p
  SET full_name = '[deleted]', role_title = NULL, jurisdiction = NULL,
      tombstoned_at = coalesce(p.tombstoned_at, clock_timestamp())
  WHERE p.workspace_id = v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_buyer_candidates own_b
      JOIN public.intentlead_opportunities own_o ON own_o.id = own_b.opportunity_id
      WHERE own_o.discovery_brief_id = p_discovery_brief_id AND own_b.person_id = p.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_buyer_candidates live_b
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_b.opportunity_id
      WHERE live_b.person_id = p.id AND live_o.tombstoned_at IS NULL
    );

  UPDATE public.intentlead_contact_points cp
  SET value = NULL, value_hash = md5(cp.id::text) || md5(cp.id::text), jurisdiction = '{}'::jsonb,
      tombstoned_at = coalesce(cp.tombstoned_at, clock_timestamp()), updated_at = clock_timestamp()
  WHERE cp.workspace_id = v_workspace_id
    AND (
      EXISTS (
        SELECT 1 FROM public.intentlead_opportunities own_o
        WHERE own_o.discovery_brief_id = p_discovery_brief_id AND own_o.company_id = cp.company_id
      )
      OR EXISTS (
        SELECT 1 FROM public.intentlead_buyer_candidates own_b
        JOIN public.intentlead_opportunities own_o ON own_o.id = own_b.opportunity_id
        WHERE own_o.discovery_brief_id = p_discovery_brief_id AND own_b.person_id = cp.person_id
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunities live_o
      WHERE live_o.tombstoned_at IS NULL
        AND (live_o.company_id = cp.company_id OR EXISTS (
          SELECT 1 FROM public.intentlead_buyer_candidates live_b
          WHERE live_b.opportunity_id = live_o.id AND live_b.person_id = cp.person_id
        ))
    );

  UPDATE public.intentlead_contact_verifications cv
  SET status = 'UNKNOWN', verification_method = 'deleted', confidence = 0,
      expires_at = NULL, tombstoned_at = coalesce(cv.tombstoned_at, clock_timestamp())
  WHERE cv.contact_point_id IN (
    SELECT cp.id FROM public.intentlead_contact_points cp
    WHERE cp.workspace_id = v_workspace_id AND cp.tombstoned_at IS NOT NULL
      AND cp.value IS NULL AND cp.value_hash = md5(cp.id::text) || md5(cp.id::text)
  );

  UPDATE public.intentlead_opportunity_assessments a
  SET signal = '{"family":"DETECTED_PROBLEM","subtype":"operations"}'::jsonb,
      problem_type = 'deleted', problem_statement = '[deleted]',
      evidence_strength = 0, explicitness = 0, urgency = 0, freshness = 0,
      commercial_impact = 0, icp_fit = 0, company_confidence = 0,
      buyer_relevance = 0, actionability = 0, confidence = 0,
      rejection_reasons = CASE WHEN decision = 'REJECT' THEN ARRAY['deleted']::text[] ELSE '{}'::text[] END,
      review_reasons = CASE WHEN decision = 'REVIEW' THEN ARRAY['deleted']::text[] ELSE '{}'::text[] END,
      tombstoned_at = coalesce(a.tombstoned_at, clock_timestamp())
  WHERE a.opportunity_id IN (
    SELECT o.id FROM public.intentlead_opportunities o
    WHERE o.workspace_id = v_workspace_id AND o.discovery_brief_id = p_discovery_brief_id
  );

  UPDATE public.intentlead_human_reviews r
  SET reason = '[deleted]', note = NULL, tombstoned_at = coalesce(r.tombstoned_at, clock_timestamp())
  WHERE r.opportunity_id IN (
    SELECT o.id FROM public.intentlead_opportunities o
    WHERE o.workspace_id = v_workspace_id AND o.discovery_brief_id = p_discovery_brief_id
  );
  UPDATE public.intentlead_outcomes o
  SET details = '{}'::jsonb, tombstoned_at = coalesce(o.tombstoned_at, clock_timestamp())
  WHERE o.opportunity_id IN (
    SELECT opp.id FROM public.intentlead_opportunities opp
    WHERE opp.workspace_id = v_workspace_id AND opp.discovery_brief_id = p_discovery_brief_id
  );

  -- The Task 4 tombstone protects shared sources. Strip remaining URL/provenance/hash
  -- material only when no live evidence still references a source or evidence row.
  UPDATE public.intentlead_evidence_items e
  SET source_url = NULL, provider_run_id = NULL,
      provenance = '{"sourceType":"HUMAN","sourceId":"deleted","providerRunId":null,"rawArtifactId":null}'::jsonb,
      content_hash = md5(e.id::text) || md5(e.id::text)
  WHERE e.workspace_id = v_workspace_id AND e.tombstoned_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence own_link
      JOIN public.intentlead_opportunities own_o ON own_o.id = own_link.opportunity_id
      WHERE own_o.discovery_brief_id = p_discovery_brief_id AND own_link.evidence_id = e.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_evidence live_link
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_link.opportunity_id
      WHERE live_link.evidence_id = e.id AND live_link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    );

  UPDATE public.intentlead_source_items s
  SET provider = 'redacted', external_id = 'deleted:' || s.id::text,
      provider_run_id = NULL, source_url = NULL, content = NULL, normalized_facts = '{}'::jsonb,
      provenance = '{"sourceType":"HUMAN","sourceId":"deleted","providerRunId":null,"rawArtifactId":null}'::jsonb,
      content_hash = md5(s.id::text) || md5(s.id::text),
      tombstoned_at = coalesce(s.tombstoned_at, clock_timestamp())
  WHERE s.workspace_id = v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      JOIN public.intentlead_opportunity_evidence own_link ON own_link.evidence_id = e.id
      JOIN public.intentlead_opportunities own_o ON own_o.id = own_link.opportunity_id
      WHERE own_o.discovery_brief_id = p_discovery_brief_id AND e.source_item_id = s.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items live_e
      JOIN public.intentlead_opportunity_evidence live_link ON live_link.evidence_id = live_e.id
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_link.opportunity_id
      WHERE live_e.source_item_id = s.id AND live_link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    );

  UPDATE public.intentlead_artifact_metadata a
  SET content_hash = md5(a.id::text) || md5(a.id::text)
  WHERE a.workspace_id = v_workspace_id
    AND EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      JOIN public.intentlead_opportunity_evidence own_link ON own_link.evidence_id = e.id
      JOIN public.intentlead_opportunities own_o ON own_o.id = own_link.opportunity_id
      WHERE own_o.discovery_brief_id = p_discovery_brief_id AND e.artifact_id = a.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items live_e
      JOIN public.intentlead_opportunity_evidence live_link ON live_link.evidence_id = live_e.id
      JOIN public.intentlead_opportunities live_o ON live_o.id = live_link.opportunity_id
      WHERE live_e.artifact_id = a.id AND live_link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
  TO service_role;
