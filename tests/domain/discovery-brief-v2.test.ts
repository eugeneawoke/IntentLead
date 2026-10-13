import { describe, expect, it } from "vitest";
import {
  CreateDiscoveryBriefCommandSchema,
  CreateDiscoveryBriefInputSchema,
  CreateDiscoveryBriefV2InputSchema,
} from "@/lib/domain/schemas/discovery-brief-command";

const v1 = {
  schemaVersion: 1,
  offer: { name: "Offer", summary: "Summary", outcomes: [], exclusions: [] },
  icp: { name: "ICP", description: "Companies", companyAttributes: [], exclusions: [] },
  objective: "Find opportunities",
  criteria: {
    jurisdictions: [], languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [],
    limits: { maxSourceItems: 25, maxOpportunities: 10 },
  },
};

const v2 = {
  schemaVersion: 2,
  offer: { name: "Offer", summary: "Summary", outcomes: ["Outcome"], exclusions: [] },
  icp: {
    name: "ICP", description: "Companies", targetBuyerDescription: null,
    companyAttributes: [], exclusions: [],
  },
  objective: "Find opportunities",
  criteria: {
    schemaVersion: 2,
    jurisdictions: [{ countryCode: "US", subdivisionCode: null }], marketIntent: ["United States"],
    languages: ["en"], signalFamilies: ["EXPRESSED_INTENT"], exclusions: [],
    requestedConfirmedSignals: 20, limits: { maxSourceItems: 25, maxOpportunities: 10 },
    intakeApproval: {
      reviewFingerprint: "a".repeat(64), requestFingerprint: "b".repeat(64), humanApproved: true,
      prompt: { templateId: "intake-v1", version: "1", systemInstructionHash: "c".repeat(64), userContentRole: "UNTRUSTED_USER" },
      telemetry: {
        model: "fixture", modelVersion: "fixture-v1", inputTokens: 1, outputTokens: 1, latencyMs: 0,
        cost: { amount: 0, currency: "USD" }, limitations: [],
      },
      marketMappings: [{ marketIntent: "United States", scope: "JURISDICTIONS", jurisdictions: [{ countryCode: "US", subdivisionCode: null }] }],
      languageMappings: [{ source: "USER_STATED", languageIntent: "English", language: "en" }], exclusionMappings: [],
    },
  },
};

describe("DiscoveryBrief create command versions", () => {
  it("keeps the exact V1 contract and accepts V1 through the command union", () => {
    expect(CreateDiscoveryBriefInputSchema.safeParse(v1).success).toBe(true);
    expect(CreateDiscoveryBriefCommandSchema.safeParse(v1).success).toBe(true);
  });

  it("accepts strict V2 and rejects V2-only fields in V1", () => {
    expect(CreateDiscoveryBriefV2InputSchema.safeParse(v2).success).toBe(true);
    expect(CreateDiscoveryBriefCommandSchema.safeParse(v2).success).toBe(true);
    expect(CreateDiscoveryBriefInputSchema.safeParse({ ...v1, criteria: v2.criteria }).success).toBe(false);
    expect(CreateDiscoveryBriefV2InputSchema.safeParse({ ...v2, enqueueJob: true }).success).toBe(false);
  });
});
