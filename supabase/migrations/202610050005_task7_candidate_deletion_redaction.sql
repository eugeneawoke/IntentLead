-- Task 7 claim text can contain incidental names/roles; erase it on Opportunity deletion.
ALTER TABLE public.intentlead_job_candidate_results
  ADD COLUMN IF NOT EXISTS redacted_at timestamptz;

COMMENT ON COLUMN public.intentlead_job_candidate_results.redacted_at IS
  'Marks deletion-time scrubbing of candidate-local claim text and source-derived candidate identity.';

CREATE OR REPLACE FUNCTION public.intentlead_redact_deleted_candidate_results()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.resource_type = 'OPPORTUNITY' THEN
    UPDATE public.intentlead_job_candidate_results
    SET grounded_claims = '[]'::jsonb,
        candidate_key = 'deleted:' || NEW.resource_id::text,
        input_hash = md5('deleted:' || NEW.resource_id::text),
        redacted_at = coalesce(redacted_at, clock_timestamp())
    WHERE workspace_id = NEW.workspace_id AND opportunity_id = NEW.resource_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.intentlead_redact_deleted_candidate_results() FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS intentlead_redact_deleted_candidate_results ON public.intentlead_deletion_tombstones;
CREATE TRIGGER intentlead_redact_deleted_candidate_results
AFTER INSERT ON public.intentlead_deletion_tombstones
FOR EACH ROW EXECUTE FUNCTION public.intentlead_redact_deleted_candidate_results();

UPDATE public.intentlead_job_candidate_results c
SET grounded_claims = '[]'::jsonb,
    candidate_key = 'deleted:' || c.opportunity_id::text,
    input_hash = md5('deleted:' || c.opportunity_id::text),
    redacted_at = coalesce(c.redacted_at, clock_timestamp())
FROM public.intentlead_deletion_tombstones t
WHERE t.workspace_id = c.workspace_id AND t.resource_type = 'OPPORTUNITY'
  AND t.resource_id = c.opportunity_id;
