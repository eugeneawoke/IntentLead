-- Atomic credit charge + lead verification
-- CRITICAL: credit_charged=true is NEVER possible when status != 'verified'
CREATE OR REPLACE FUNCTION verify_lead_and_charge_credit(
  p_lead_id uuid,
  p_workspace_id uuid
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_credits int;
  v_plan text;
  v_free_used boolean;
BEGIN
  -- Lock the workspace row to prevent race conditions
  SELECT credits_remaining, plan, free_converter_used
  INTO v_credits, v_plan, v_free_used
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'workspace_not_found';
  END IF;

  -- Prevent double-charging
  PERFORM 1 FROM leads WHERE id = p_lead_id AND credit_charged = true;
  IF FOUND THEN
    RAISE EXCEPTION 'lead_already_charged';
  END IF;

  -- Check free plan limits
  IF v_plan = 'free' AND v_free_used = true THEN
    RAISE EXCEPTION 'free_converter_exhausted';
  END IF;

  -- Check credits
  IF v_credits <= 0 THEN
    RAISE EXCEPTION 'insufficient_credits';
  END IF;

  -- Verify all 4 levels are green before marking verified
  PERFORM 1 FROM leads
  WHERE id = p_lead_id
    AND verify_signal = true
    AND verify_company = true
    AND verify_contact = true
    AND verify_email = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_fully_verified';
  END IF;

  -- Mark lead as verified and charge credit atomically
  UPDATE leads
  SET status = 'verified',
      credit_charged = true,
      updated_at = now()
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead_not_found';
  END IF;

  -- Deduct credit
  UPDATE workspaces
  SET credits_remaining = credits_remaining - 1,
      updated_at = now()
  WHERE id = p_workspace_id;

  -- Check if free converter used up (10th verified lead)
  IF v_plan = 'free' AND v_credits - 1 <= 0 THEN
    UPDATE workspaces
    SET free_converter_used = true,
        updated_at = now()
    WHERE id = p_workspace_id;
  END IF;
END;
$$;

-- Helper: updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER trg_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
