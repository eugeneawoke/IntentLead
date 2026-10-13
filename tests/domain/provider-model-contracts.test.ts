import { describe, expect, it } from "vitest";
import {
  ContactDiscoveryCandidateSchema,
  ContactVerificationObservationSchema,
  PersonSearchInputSchema,
} from "../../lib/domain/schemas/provider-research";
import {
  GroundedModelClaimSchema,
  ModelInvocationPolicySchema,
  ModelProviderDescriptorSchema,
  StructuredDiscoveryIntakeSchema,
} from "../../lib/domain/schemas/model-provider";

describe("provider research contracts", () => {
  it("keeps contact discovery distinct from verification", () => {
    const found = {
      state: "FOUND",
      channel: "email",
      value: "owner@example.com",
      scope: "PERSON",
      source: { kind: "PUBLIC_WEB", url: "https://example.com/team", providerRunId: null },
      capturedAt: "2026-10-08T12:00:00.000Z",
      confidence: 0.8,
    };
    expect(ContactDiscoveryCandidateSchema.parse(found)).not.toHaveProperty("status", "VALID");
    expect(ContactVerificationObservationSchema.safeParse({
      status: "VALID", method: "PROVIDER", checkedAt: "2026-10-08T12:00:00.000Z",
      expiresAt: null, confidence: 0.9, providerReason: null,
    }).success).toBe(false);
  });

  it("requires identity evidence before person search", () => {
    expect(PersonSearchInputSchema.safeParse({
      companyId: "company-1", companyName: "Acme", companyDomain: "acme.example",
      desiredRoles: ["Head of Product"], evidenceIds: [], maxResults: 5,
    }).success).toBe(false);
  });
});

describe("model provider contracts", () => {
  it("keeps an unconfigured model unavailable without inventing intake fields", () => {
    expect(ModelProviderDescriptorSchema.parse({
      id: "openai", model: "configured-later", version: "v1",
      capabilities: ["STRUCTURE_DISCOVERY_BRIEF"], operationalState: "paid_locked",
      maxInputTokens: 16_000, configuredCostPerMillionInputTokens: null,
      configuredCostPerMillionOutputTokens: null, configuredCostCurrency: null,
    }).operationalState).toBe("paid_locked");

    expect(StructuredDiscoveryIntakeSchema.parse({
      offerSummary: null, desiredOutcomes: [], targetCompanyDescription: null,
      targetBuyerDescription: null, markets: [], languages: [], exclusions: [],
      requestedConfirmedSignals: null, missingRequiredFields: ["offer", "target_company", "market"],
      assumptionsForReview: [],
    }).missingRequiredFields).toHaveLength(3);
  });

  it("rejects grounded claims without evidence", () => {
    expect(GroundedModelClaimSchema.safeParse({ id: "claim-1", text: "Acme is hiring", evidenceIds: [] }).success).toBe(false);
  });

  it("makes missing intake constraints and model authority explicit", () => {
    expect(StructuredDiscoveryIntakeSchema.safeParse({
      offerSummary: null, desiredOutcomes: [], targetCompanyDescription: null,
      targetBuyerDescription: null, markets: [], languages: [], exclusions: [],
      requestedConfirmedSignals: null, missingRequiredFields: [], assumptionsForReview: [],
    }).success).toBe(false);
    expect(ModelInvocationPolicySchema.safeParse({
      capability: "DRAFT_GROUNDED_COPY", evidenceIds: [],
      budget: { currency: "USD", remainingCost: 0, remainingInputTokens: 1000, remainingOutputTokens: 500, remainingCalls: 1 },
      allowExternalActions: false, allowProviderSelection: false, sourceContentRole: "UNTRUSTED_DATA",
    }).success).toBe(false);
  });
});
