import { describe, expect, it, vi } from "vitest";
import {
  createApprovedDiscoveryBrief,
  fingerprintConversationalIntakeReview,
  prepareApprovedDiscoveryBrief,
} from "@/lib/application/conversational-intake-approval";
import type { ApplicationSupabaseClient } from "@/lib/application/context";
import {
  conversationalIntakeApproval as approval,
  conversationalIntakeReview as review,
} from "@/tests/fixtures/conversational-intake";

const prompt = review.prompt;
const telemetry = review.telemetry;

describe("prepareApprovedDiscoveryBrief", () => {
  it("preserves every material value and produces a stable V2 key", () => {
    const first = prepareApprovedDiscoveryBrief(approval());
    const replay = prepareApprovedDiscoveryBrief(approval());
    expect(first).toEqual(replay);
    expect(first.idempotencyKey).toMatch(/^intake-v2:[a-f0-9]{64}$/);
    expect(first.command).toMatchObject({
      schemaVersion: 2,
      offer: { summary: "workflow software", outcomes: ["faster delivery"] },
      icp: { description: "US agencies", targetBuyerDescription: "operations leaders" },
      criteria: {
        marketIntent: ["US", "Canada"], languages: ["en", "fr"],
        requestedConfirmedSignals: 30, limits: { maxSourceItems: 80, maxOpportunities: 15 },
        intakeApproval: { humanApproved: true, prompt, telemetry },
      },
    });
    expect(first.command.criteria.requestedConfirmedSignals).not.toBe(first.command.criteria.limits.maxSourceItems);
  });

  it("changes the key for changed approved mapping, limits or name", () => {
    const baseline = prepareApprovedDiscoveryBrief(approval()).idempotencyKey;
    const changedMapping = prepareApprovedDiscoveryBrief(approval({
      marketMappings: [
        { marketIntent: "US", scope: "JURISDICTIONS", jurisdictions: [{ countryCode: "US", subdivisionCode: "CA" }] },
        approval().marketMappings[1],
      ],
      executionCriteria: {
        ...approval().executionCriteria,
        jurisdictions: [{ countryCode: "US", subdivisionCode: "CA" }, { countryCode: "CA", subdivisionCode: null }],
      },
    })).idempotencyKey;
    const changedLimits = prepareApprovedDiscoveryBrief(approval({
      executionCriteria: {
        ...approval().executionCriteria,
        limits: { maxSourceItems: 81, maxOpportunities: 15 },
      },
    })).idempotencyKey;
    const changedName = prepareApprovedDiscoveryBrief(approval({
      names: { offer: "Renamed workflow offer", icp: "Agency ICP" },
    })).idempotencyKey;
    const changedObjective = prepareApprovedDiscoveryBrief(approval({
      objective: "Find a different approved opportunity set",
    })).idempotencyKey;
    const changedSignalFamily = prepareApprovedDiscoveryBrief(approval({
      executionCriteria: {
        ...approval().executionCriteria,
        signalFamilies: ["DETECTED_PROBLEM"],
      },
    })).idempotencyKey;
    expect(new Set([
      baseline, changedMapping, changedLimits, changedName, changedObjective, changedSignalFamily,
    ]).size).toBe(6);
  });

  it("rejects a stale fingerprint and a clarification review", () => {
    expect(() => prepareApprovedDiscoveryBrief(approval({ submittedReviewFingerprint: "c".repeat(64) })))
      .toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    const incomplete = {
      ...review,
      state: "NEEDS_CLARIFICATION" as const,
      intake: { ...review.intake, markets: [], missingRequiredFields: ["market" as const] },
      fieldSupports: review.fieldSupports.filter(support => support.field !== "markets"),
      clarificationQuestions: [{ field: "market" as const, question: "Which market?" }],
    };
    expect(() => prepareApprovedDiscoveryBrief(approval({
      review: incomplete,
      submittedReviewFingerprint: fingerprintConversationalIntakeReview(incomplete),
    }))).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("fails closed on missing or unmapped market and language values", () => {
    expect(() => prepareApprovedDiscoveryBrief(approval({ marketMappings: approval().marketMappings.slice(0, 1) })))
      .toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => prepareApprovedDiscoveryBrief(approval({ languageMappings: approval().languageMappings.slice(0, 1) })))
      .toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
    expect(() => prepareApprovedDiscoveryBrief(approval({
      executionCriteria: { ...approval().executionCriteria, languages: ["en", "de"] },
    }))).toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("requires explicit HUMAN_ADDED provenance when the review stated no language", () => {
    const noLanguageReview = {
      ...review,
      intake: { ...review.intake, languages: [] },
      fieldSupports: review.fieldSupports.filter(support => support.field !== "languages"),
    };
    const base = {
      review: noLanguageReview,
      submittedReviewFingerprint: fingerprintConversationalIntakeReview(noLanguageReview),
      languageMappings: [{
        source: "HUMAN_ADDED", languageIntent: null, language: "en", rationale: "Operator approved English execution",
      }],
      executionCriteria: { ...approval().executionCriteria, languages: ["en"] },
    };
    expect(prepareApprovedDiscoveryBrief(approval(base)).command.criteria.languages).toEqual(["en"]);
    expect(() => prepareApprovedDiscoveryBrief(approval({ ...base, languageMappings: [] })))
      .toThrow(expect.objectContaining({ code: "INVALID_INPUT" }));
  });

  it("creates only through the dedicated service RPC from a full approval", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      discoveryBriefId: "brief-1", workspaceId: "workspace-1", offerProfileId: "offer-1",
      icpDefinitionId: "icp-1", marketProfileId: "market-1", created: true,
    }, error: null });
    const client = { rpc } as ApplicationSupabaseClient;
    await expect(createApprovedDiscoveryBrief(
      client, "11111111-1111-4111-8111-111111111111", approval(),
    )).resolves.toMatchObject({ discoveryBriefId: "brief-1", created: true });
    expect(rpc).toHaveBeenCalledWith("intentlead_create_approved_discovery_brief", expect.objectContaining({
      p_user_id: "11111111-1111-4111-8111-111111111111",
      p_command: expect.objectContaining({ schemaVersion: 2 }),
      p_idempotency_key: expect.stringMatching(/^intake-v2:[a-f0-9]{64}$/),
    }));
    await expect(createApprovedDiscoveryBrief(client, "not-a-uuid", approval()))
      .rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(createApprovedDiscoveryBrief(
      client, "11111111-1111-4111-8111-111111111111", prepareApprovedDiscoveryBrief(approval()),
    )).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["idempotency_conflict", "CONFLICT"],
    ["invalid_approved_discovery_command", "INVALID_INPUT"],
    ["forbidden", "FORBIDDEN"],
    ["permission denied for function intentlead_create_approved_discovery_brief", "FORBIDDEN"],
  ])("maps dedicated RPC error %s", async (message, code) => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) } as ApplicationSupabaseClient;
    await expect(createApprovedDiscoveryBrief(
      client, "11111111-1111-4111-8111-111111111111", approval(),
    )).rejects.toMatchObject({ code });
  });
});
