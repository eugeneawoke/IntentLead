-- Run a final provider-metadata scrub only after the owner deletion cascade has
-- tombstoned its Opportunities, sources, and evidence.
DO $$
BEGIN
  IF to_regprocedure('public.intentlead_delete_discovery_brief_task7_v2(uuid,uuid,text)') IS NULL THEN
    ALTER FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
      RENAME TO intentlead_delete_discovery_brief_task7_v2;
  END IF;
END
$$;

REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief_task7_v2(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;

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
BEGIN
  IF NOT public.intentlead_delete_discovery_brief_task7_v2(
    p_discovery_brief_id, p_user_id, p_reason
  ) THEN RETURN false; END IF;

  SELECT workspace_id INTO v_workspace_id
  FROM public.intentlead_discovery_briefs WHERE id = p_discovery_brief_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'forbidden'; END IF;

  UPDATE public.intentlead_provider_runs pr
  SET provider = 'redacted', provider_version = NULL,
      status = CASE WHEN status = 'STARTED' THEN 'FAILED' ELSE status END,
      request_metadata = '{}'::jsonb, response_metadata = '{}'::jsonb,
      latency_ms = NULL, usage_units = 0, cost_amount = 0, currency = NULL,
      finished_at = coalesce(finished_at, clock_timestamp())
  WHERE pr.workspace_id = v_workspace_id
    AND pr.job_id IN (
      SELECT j.id FROM public.intentlead_jobs j
      WHERE j.workspace_id = v_workspace_id AND j.discovery_brief_id = p_discovery_brief_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_source_items s
      WHERE s.workspace_id = pr.workspace_id AND s.provider_run_id = pr.id
        AND (s.tombstoned_at IS NULL OR EXISTS (
          SELECT 1 FROM public.intentlead_evidence_items e
          JOIN public.intentlead_opportunity_evidence link ON link.evidence_id = e.id
          JOIN public.intentlead_opportunities live_o ON live_o.id = link.opportunity_id
          WHERE e.workspace_id = s.workspace_id AND e.source_item_id = s.id
            AND link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
        ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_evidence_items e
      WHERE e.workspace_id = pr.workspace_id AND e.provider_run_id = pr.id
        AND (e.tombstoned_at IS NULL OR EXISTS (
          SELECT 1 FROM public.intentlead_opportunity_evidence link
          JOIN public.intentlead_opportunities live_o ON live_o.id = link.opportunity_id
          WHERE link.workspace_id = e.workspace_id AND link.evidence_id = e.id
            AND link.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
        ))
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_opportunity_assessments a
      JOIN public.intentlead_opportunities live_o
        ON live_o.workspace_id = a.workspace_id AND live_o.id = a.opportunity_id
      WHERE a.workspace_id = pr.workspace_id AND a.model_run_id = pr.id
        AND a.tombstoned_at IS NULL AND live_o.tombstoned_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_job_discovery_slices d
      JOIN public.intentlead_opportunities live_o
        ON live_o.workspace_id = d.workspace_id AND live_o.id = d.opportunity_id
      WHERE d.workspace_id = pr.workspace_id AND d.provider_run_id = pr.id
        AND live_o.tombstoned_at IS NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.intentlead_job_step_provider_runs link
      JOIN public.intentlead_job_step_attempts a ON a.id = link.step_attempt_id
      JOIN public.intentlead_jobs live_job ON live_job.id = a.job_id
      WHERE link.workspace_id = pr.workspace_id AND link.provider_run_id = pr.id
        AND live_job.discovery_brief_id IS DISTINCT FROM p_discovery_brief_id
    );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.intentlead_delete_discovery_brief(uuid, uuid, text)
  TO service_role;
