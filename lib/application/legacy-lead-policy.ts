import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplicationError } from "./errors";

export async function assertLegacyLeadRouteAllowed(campaignId: string, client: SupabaseClient): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
    throw new ApplicationError("INVALID_INPUT", "Campaign id is invalid");
  }
  const { data, error } = await client.rpc("intentlead_legacy_campaign_is_discovery_only", {
    p_campaign_id: campaignId,
  });
  if (error) throw new ApplicationError("INTERNAL_ERROR", "Could not verify campaign policy", { cause: error });
  if (data === true) {
    throw new ApplicationError("POLICY_DENIED", "Legacy lead access is disabled for discovery-only campaigns");
  }
}
