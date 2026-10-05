import type { SupabaseClient } from "@supabase/supabase-js";
import { ApplicationError } from "./errors";

export async function assertLegacyLeadRouteAllowed(campaignId: string, client: SupabaseClient): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(campaignId)) {
    throw new ApplicationError("INVALID_INPUT", "Campaign id is invalid");
  }
  const { data, error } = await client
    .from("intentlead_discovery_briefs")
    .select("market_profile:intentlead_market_profiles!inner(profile_key,workflow)")
    .eq("legacy_campaign_id", campaignId)
    .limit(2);
  if (error) throw new ApplicationError("INTERNAL_ERROR", "Could not verify campaign policy", { cause: error });
  const profiles = (data ?? []).flatMap(row => {
    const profile = row.market_profile;
    return Array.isArray(profile) ? profile : profile ? [profile] : [];
  });
  if (profiles.some(profile => profile.profile_key === "EN_DISCOVERY_ONLY" || profile.workflow === "DISCOVERY_ONLY")) {
    throw new ApplicationError("POLICY_DENIED", "Legacy lead access is disabled for discovery-only campaigns");
  }
}
