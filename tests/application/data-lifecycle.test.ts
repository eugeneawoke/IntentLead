import { describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "@/lib/domain/schemas/market-profile";
import { deleteDiscoveryBrief } from "@/lib/application/data-lifecycle";
import type { ApplicationContext } from "@/lib/application/context";

const marketProfile = MarketProfileSchema.parse({
  schemaVersion: 1,
  id: "EN_DISCOVERY_ONLY",
  workspaceId: "workspace-1",
  jurisdictions: [],
  regions: [],
  languages: ["en"],
  capabilities: ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
  disabledCapabilities: ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"],
  legalPolicyId: "legal-v1",
  retentionPolicyId: "retention-v1",
  outreachPolicyId: null,
  outreachChannels: [],
  defaultCurrency: "USD",
  timezone: "UTC",
  workflow: "DISCOVERY_ONLY",
});

const ownerContext: ApplicationContext = {
  authenticatedUserId: "owner-1",
  workspace: { id: "workspace-1", role: "OWNER" },
  campaignId: "campaign-1",
  discoveryBriefId: "brief-1",
  traceId: "trace-1",
  permissions: new Set(marketProfile.capabilities),
  budget: { currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 },
  marketProfile,
};

describe("deleteDiscoveryBrief", () => {
  it("calls the owner-authorized deletion boundary with stored context", async () => {
    const deleteBrief = vi.fn().mockResolvedValue(true);

    await expect(deleteDiscoveryBrief(ownerContext, {
      schemaVersion: 1,
      discoveryBriefId: "brief-1",
    }, { deleteBrief })).resolves.toEqual({ deleted: true });

    expect(deleteBrief).toHaveBeenCalledWith({
      discoveryBriefId: "brief-1",
      userId: "owner-1",
      reason: "owner_requested",
    });
  });

  it("does not disclose or delete a brief outside the authorized context", async () => {
    const deleteBrief = vi.fn();

    await expect(deleteDiscoveryBrief(ownerContext, {
      schemaVersion: 1,
      discoveryBriefId: "other-brief",
    }, { deleteBrief })).rejects.toMatchObject({ code: "NOT_FOUND" });

    expect(deleteBrief).not.toHaveBeenCalled();
  });

  it("maps a database ownership denial to not-found", async () => {
    const deleteBrief = vi.fn().mockRejectedValue(new Error("forbidden"));

    await expect(deleteDiscoveryBrief(ownerContext, {
      schemaVersion: 1,
      discoveryBriefId: "brief-1",
    }, { deleteBrief })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
