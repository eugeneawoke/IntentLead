import { describe, expect, it } from "vitest";
import type { CreateDiscoveryBriefInput } from "../../lib/application/discovery-briefs";
import { discoveryCreateIdempotencyKey } from "../../components/discovery/discovery-api";

const command: CreateDiscoveryBriefInput = {
  schemaVersion: 1,
  offer: { name: "IntentLead", summary: "Opportunity intelligence", outcomes: ["Better research"], exclusions: [] },
  icp: { name: "B2B teams", description: "Teams researching companies", companyAttributes: ["B2B"], exclusions: [] },
  objective: "Find evidence-backed company opportunities",
  criteria: {
    jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [],
    limits: { maxSourceItems: 20, maxOpportunities: 5 },
  },
};

describe("discovery create idempotency", () => {
  it("reuses one content-derived key after a lost response and changes it for a new command", async () => {
    const first = await discoveryCreateIdempotencyKey(command);
    const retry = await discoveryCreateIdempotencyKey(command);
    const changed = await discoveryCreateIdempotencyKey({ ...command, objective: `${command.objective} in Europe` });

    expect(first).toBe(retry);
    expect(first).not.toBe(changed);
    expect(first).toMatch(/^discovery-ui-v1:[a-f0-9]{64}$/);
  });
});
