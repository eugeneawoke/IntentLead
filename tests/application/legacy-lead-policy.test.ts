import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertLegacyLeadRouteAllowed } from "@/lib/application/legacy-lead-policy";

const campaignId = "6a4b2e8e-f3c8-45be-a1cb-9abc12345678";

function client(data: unknown, error: { message: string } | null = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error });
  const from = vi.fn(() => { throw new Error("Legacy policy must not read IntentLead tables directly"); });
  return { value: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe("legacy lead policy boundary", () => {
  it("uses an unbounded database EXISTS policy check before legacy reads", async () => {
    const fake = client(true);

    await expect(assertLegacyLeadRouteAllowed(campaignId, fake.value))
      .rejects.toMatchObject({ code: "POLICY_DENIED" });

    expect(fake.rpc).toHaveBeenCalledWith("intentlead_legacy_campaign_is_discovery_only", { p_campaign_id: campaignId });
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("preserves the legacy path for non-pilot and non-member campaign reads", async () => {
    const fake = client(false);

    await expect(assertLegacyLeadRouteAllowed(campaignId, fake.value)).resolves.toBeUndefined();
    expect(fake.rpc).toHaveBeenCalledTimes(1);
    expect(fake.from).not.toHaveBeenCalled();
  });

  it("fails closed when the policy RPC cannot be checked", async () => {
    const fake = client(null, { message: "offline" });

    await expect(assertLegacyLeadRouteAllowed(campaignId, fake.value))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });
});
