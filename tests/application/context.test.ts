import { describe, expect, it, vi } from "vitest";
import { createApplicationContext, type ApplicationSupabaseClient } from "@/lib/application/context";

type QueryResult = {
  data: Record<string, unknown> | null;
  error: { code?: string; message?: string } | null;
};

const profileConfig = {
  jurisdictions: [],
  regions: [],
  languages: ["en"],
  legalPolicyId: "legal-v1",
  retentionPolicyId: "retention-v1",
  outreachPolicyId: null,
  outreachChannels: [],
  defaultCurrency: "USD",
  timezone: "UTC",
};

const profileRow = {
  id: "profile-id",
  workspace_id: "workspace-from-db",
  profile_key: "EN_DISCOVERY_ONLY",
  workflow: "DISCOVERY_ONLY",
  configuration: profileConfig,
  capabilities: ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
  disabled_capabilities: ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"],
};

function fakeClient(results: QueryResult[]) {
  const queriedTables: string[] = [];
  const client: ApplicationSupabaseClient = {
    from(table: string) {
      queriedTables.push(table);
      const result = results.shift() ?? { data: null, error: null };
      const query = {
        eq: vi.fn(() => query),
        single: vi.fn().mockResolvedValue(result),
        maybeSingle: vi.fn().mockResolvedValue(result),
      };
      return { select: vi.fn(() => query) };
    },
  };
  return { client, queriedTables };
}

describe("createApplicationContext", () => {
  it("derives owner, workspace, brief and permissions from stored relations", async () => {
    const { client, queriedTables } = fakeClient([
      { data: { id: "campaign-1", workspace_id: "workspace-from-db" }, error: null },
      { data: { id: "workspace-from-db", owner_id: "owner-1" }, error: null },
      { data: { id: "brief-1", workspace_id: "workspace-from-db", legacy_campaign_id: "campaign-1", market_profile_id: "profile-id" }, error: null },
      { data: profileRow, error: null },
    ]);
    const input = { authenticatedUserId: "owner-1", campaignId: "campaign-1", workspaceId: "forged-workspace" } as Parameters<typeof createApplicationContext>[0];

    const context = await createApplicationContext(input, client);

    expect(context.workspace).toEqual({ id: "workspace-from-db", role: "OWNER" });
    expect(context.discoveryBriefId).toBe("brief-1");
    expect(context.permissions.has("SOURCE_SEARCH")).toBe(true);
    expect(context.permissions.has("CONTACT_ENRICHMENT")).toBe(false);
    expect(context.budget).toEqual({ currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 });
    expect(queriedTables).toEqual([
      "campaigns", "workspaces", "intentlead_discovery_briefs", "intentlead_market_profiles",
    ]);
  });

  it("denies a non-owner before loading discovery setup", async () => {
    const { client, queriedTables } = fakeClient([
      { data: { id: "campaign-1", workspace_id: "workspace-from-db" }, error: null },
      { data: { id: "workspace-from-db", owner_id: "another-user" }, error: null },
    ]);

    await expect(createApplicationContext({ authenticatedUserId: "owner-1", campaignId: "campaign-1" }, client))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(queriedTables).toEqual(["campaigns", "workspaces"]);
  });

  it("returns a setup conflict instead of inventing a missing DiscoveryBrief", async () => {
    const { client } = fakeClient([
      { data: { id: "campaign-1", workspace_id: "workspace-from-db" }, error: null },
      { data: { id: "workspace-from-db", owner_id: "owner-1" }, error: null },
      { data: null, error: null },
    ]);

    await expect(createApplicationContext({ authenticatedUserId: "owner-1", campaignId: "campaign-1" }, client))
      .rejects.toMatchObject({ code: "CONFLICT" });
  });

  it.each(["CIS_RU", "LOCAL_CUSTOM"] as const)(
    "fails closed for stored %s profiles even when they declare discovery capability",
    async profileKey => {
      const localConfiguration = {
        ...profileConfig,
        jurisdictions: [{ countryCode: "RU", subdivisionCode: null }],
      };
      const storedProfile = {
        ...profileRow,
        profile_key: profileKey,
        workflow: "DISCOVERY_ONLY",
        configuration: profileKey === "LOCAL_CUSTOM"
          ? { ...localConfiguration, category: "technology", geography: "Russia" }
          : localConfiguration,
      };
      const { client } = fakeClient([
        { data: { id: "campaign-1", workspace_id: "workspace-from-db" }, error: null },
        { data: { id: "workspace-from-db", owner_id: "owner-1" }, error: null },
        { data: { id: "brief-1", workspace_id: "workspace-from-db", legacy_campaign_id: "campaign-1", market_profile_id: "profile-id" }, error: null },
        { data: storedProfile, error: null },
      ]);

      await expect(createApplicationContext({ authenticatedUserId: "owner-1", campaignId: "campaign-1" }, client))
        .rejects.toMatchObject({ code: "POLICY_DENIED" });
    },
  );
});
