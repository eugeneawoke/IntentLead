import { describe, expect, it, vi } from "vitest";
import { createDiscoveryBrief, CreateDiscoveryBriefInputSchema } from "@/lib/application/discovery-briefs";
import type { ApplicationSupabaseClient } from "@/lib/application/context";

const command = {
  schemaVersion: 1,
  offer: { name: "Opportunity research", summary: "Find evidence-backed company opportunities", outcomes: [], exclusions: [] },
  icp: { name: "B2B teams", description: "Small B2B service companies", companyAttributes: [], exclusions: [] },
  objective: "Find companies with an observable commercial problem",
  criteria: {
    jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT"],
    exclusions: [], limits: { maxSourceItems: 25, maxOpportunities: 10 },
  },
} as const;

describe("native DiscoveryBrief command", () => {
  it("accepts business context without website-audit fields", async () => {
    expect(CreateDiscoveryBriefInputSchema.safeParse(command).success).toBe(true);
    expect(CreateDiscoveryBriefInputSchema.safeParse({ ...command, technicalAudit: true }).success).toBe(false);
    const rpc = vi.fn().mockResolvedValue({ data: {
      discoveryBriefId: "brief-1", workspaceId: "workspace-1", offerProfileId: "offer-1",
      icpDefinitionId: "icp-1", marketProfileId: "market-1", created: true,
    }, error: null });
    await expect(createDiscoveryBrief({ rpc } as ApplicationSupabaseClient, command, "create-brief-0001"))
      .resolves.toMatchObject({ discoveryBriefId: "brief-1", created: true });
    expect(rpc).toHaveBeenCalledWith("intentlead_create_discovery_brief", {
      p_command: expect.objectContaining({ objective: command.objective }),
      p_idempotency_key: "create-brief-0001",
    });
  });

  it("rejects missing idempotency and maps conflicting replay", async () => {
    const client = { rpc: vi.fn() } as unknown as ApplicationSupabaseClient;
    await expect(createDiscoveryBrief(client, command, "short")).rejects.toMatchObject({ code: "INVALID_INPUT" });
    const conflict = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "idempotency_conflict" } }) } as ApplicationSupabaseClient;
    await expect(createDiscoveryBrief(conflict, command, "create-brief-0001")).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
