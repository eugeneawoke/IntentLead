import { describe, expect, it, vi } from "vitest";
import type { ApplicationContext } from "@/lib/application/context";
import type { MarketProfile } from "@/types/market-profile";
import {
  StartOpportunitySearchInputSchema,
  startOpportunitySearch,
} from "@/lib/application/opportunities";

const profile: MarketProfile = {
  schemaVersion: 1,
  id: "EN_DISCOVERY_ONLY",
  workspaceId: "workspace-1",
  jurisdictions: [],
  regions: [],
  languages: ["en"],
  capabilities: ["SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
  disabledCapabilities: ["PEOPLE_SEARCH", "CONTACT_ENRICHMENT", "EMAIL_FIND", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY", "OUTREACH_SEND", "OUTCOME_RECORDING", "PACKAGE_VERIFIED"],
  legalPolicyId: "policy-legal-v1",
  retentionPolicyId: "policy-retention-v1",
  outreachPolicyId: null,
  outreachChannels: [] as const,
  defaultCurrency: "USD",
  timezone: "UTC",
  workflow: "DISCOVERY_ONLY" as const,
};

const context: ApplicationContext = {
  authenticatedUserId: "owner-1",
  workspace: { id: "workspace-1", role: "OWNER" },
  campaignId: "campaign-1",
  discoveryBriefId: "brief-1",
  traceId: "trace-1",
  permissions: new Set(profile.capabilities),
  budget: { currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 },
  marketProfile: profile,
};

describe("startOpportunitySearch", () => {
  it("rejects client-supplied workspace authority", () => {
    expect(StartOpportunitySearchInputSchema.safeParse({
      schemaVersion: 1,
      campaignId: "campaign-1",
      idempotencyKey: "request-1",
      workspaceId: "attacker-workspace",
    }).success).toBe(false);
  });

  it("atomically enqueues the server-authorized brief and returns its durable job id", async () => {
    const enqueueDiscoveryJob = vi.fn().mockResolvedValue("job-1");

    await expect(startOpportunitySearch(context, {
      schemaVersion: 1,
      campaignId: "campaign-1",
      idempotencyKey: "request-1",
    }, { enqueueDiscoveryJob })).resolves.toEqual({ jobId: "job-1" });

    expect(enqueueDiscoveryJob).toHaveBeenCalledWith({
      discoveryBriefId: "brief-1",
      userId: "owner-1",
      idempotencyKey: "request-1",
      payload: {},
    });
  });

  it("maps a conflicting idempotency identity to a provider-neutral conflict", async () => {
    const enqueueDiscoveryJob = vi.fn().mockRejectedValue(new Error("idempotency_conflict"));

    await expect(startOpportunitySearch(context, {
      schemaVersion: 1,
      campaignId: "campaign-1",
      idempotencyKey: "request-1",
    }, { enqueueDiscoveryJob })).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
