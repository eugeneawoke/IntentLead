import { describe, expect, it, vi } from "vitest";
import { createApplicationContext, type ApplicationSupabaseClient } from "@/lib/application/context";

const profileConfig = {
  jurisdictions: [], regions: [], languages: ["en"], legalPolicyId: "legal-v1",
  retentionPolicyId: "retention-v1",
  defaultCurrency: "USD", timezone: "UTC",
};

function contextRow(overrides: Record<string, unknown> = {}) {
  return {
    discovery_brief_id: "brief-1", workspace_id: "workspace-from-db",
    profile_key: "EN_DISCOVERY_ONLY", workflow: "DISCOVERY_ONLY", configuration: profileConfig,
    capabilities: ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
    disabled_capabilities: ["WEB_FETCH"],
    ...overrides,
  };
}

function fakeClient(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as ApplicationSupabaseClient, rpc };
}

describe("createApplicationContext", () => {
  it("derives owner workspace, brief and permissions from the owner-scoped native RPC", async () => {
    const { client, rpc } = fakeClient({ data: [contextRow()], error: null });
    const input = { authenticatedUserId: "owner-1", discoveryBriefId: "brief-1", workspaceId: "forged" } as Parameters<typeof createApplicationContext>[0];

    const context = await createApplicationContext(input, client);

    expect(context.workspace).toEqual({ id: "workspace-from-db", role: "OWNER" });
    expect(context.discoveryBriefId).toBe("brief-1");
    expect(context.permissions.has("SOURCE_SEARCH")).toBe(true);
    expect(context.permissions.has("WEB_FETCH")).toBe(false);
    expect(context.budget).toEqual({ currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 });
    expect(rpc).toHaveBeenCalledWith("intentlead_discovery_context", { p_discovery_brief_id: "brief-1" });
  });

  it("does not disclose a missing or cross-tenant brief", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(createApplicationContext({ authenticatedUserId: "owner-1", discoveryBriefId: "other" }, client))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each(["CIS_RU", "LOCAL_CUSTOM"] as const)(
    "fails closed for stored %s profiles",
    async profileKey => {
      const configuration = profileKey === "LOCAL_CUSTOM"
        ? { ...profileConfig, jurisdictions: [{ countryCode: "RU", subdivisionCode: null }], category: "technology", geography: "Russia" }
        : { ...profileConfig, jurisdictions: [{ countryCode: "RU", subdivisionCode: null }] };
      const { client } = fakeClient({ data: [contextRow({ profile_key: profileKey, configuration })], error: null });
      await expect(createApplicationContext({ authenticatedUserId: "owner-1", discoveryBriefId: "brief-1" }, client))
        .rejects.toMatchObject({ code: "POLICY_DENIED" });
    },
  );
});
