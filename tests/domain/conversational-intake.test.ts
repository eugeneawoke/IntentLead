import { describe, expect, it } from "vitest";
import {
  ConversationalIntakeReviewSchema,
  StructureConversationalIntakeInputSchema,
} from "../../lib/domain/schemas/conversational-intake";

const prompt = {
  templateId: "intake-v1", version: "1", systemInstructionHash: "a".repeat(64), userContentRole: "UNTRUSTED_USER",
} as const;
const telemetry = {
  model: "fixture", modelVersion: "fixture-v1", inputTokens: 10, outputTokens: 10, latencyMs: 0,
  cost: { amount: 0, currency: "USD" }, limitations: ["SYNTHETIC_FIXTURE"],
};

describe("conversational intake contracts", () => {
  it("bounds turn count, size, total content and unique ids", () => {
    expect(StructureConversationalIntakeInputSchema.safeParse({ schemaVersion: 1, userTurns: [] }).success).toBe(false);
    expect(StructureConversationalIntakeInputSchema.safeParse({
      schemaVersion: 1, userTurns: [{ id: "same", content: "one" }, { id: "same", content: "two" }],
    }).success).toBe(false);
    expect(StructureConversationalIntakeInputSchema.safeParse({
      schemaVersion: 1, userTurns: [{ id: "one", content: "x".repeat(2_001) }],
    }).success).toBe(false);
    expect(StructureConversationalIntakeInputSchema.safeParse({
      schemaVersion: 1,
      userTurns: Array.from({ length: 5 }, (_, index) => ({ id: `turn-${index}`, content: "x".repeat(1_601) })),
    }).success).toBe(false);
  });

  it("accepts a review only when every material value has exact turn support", () => {
    const base = {
      schemaVersion: 1 as const, state: "READY_FOR_REVIEW" as const, requestFingerprint: "b".repeat(64),
      userTurns: [{ id: "turn-1", content: "We sell workflow software to US agencies and want 20 signals." }],
      intake: {
        offerSummary: "workflow software", desiredOutcomes: [], targetCompanyDescription: "US agencies",
        targetBuyerDescription: null, markets: ["US"], languages: [], exclusions: [], requestedConfirmedSignals: 20,
        missingRequiredFields: [], assumptionsForReview: [],
      },
      fieldSupports: [
        { field: "offerSummary", value: "workflow software", turnId: "turn-1", quote: "workflow software" },
        { field: "targetCompanyDescription", value: "US agencies", turnId: "turn-1", quote: "US agencies" },
        { field: "markets", value: "US", turnId: "turn-1", quote: "US" },
        { field: "requestedConfirmedSignals", value: 20, turnId: "turn-1", quote: "20" },
      ],
      clarificationQuestions: [], telemetry, prompt,
    };
    expect(ConversationalIntakeReviewSchema.safeParse(base).success).toBe(true);
    expect(ConversationalIntakeReviewSchema.safeParse({
      ...base,
      fieldSupports: base.fieldSupports.map(item => item.field === "markets" ? { ...item, quote: "Europe" } : item),
    }).success).toBe(false);
    expect(ConversationalIntakeReviewSchema.safeParse({
      ...base, fieldSupports: base.fieldSupports.filter(item => item.field !== "offerSummary"),
    }).success).toBe(false);
    expect(ConversationalIntakeReviewSchema.safeParse({
      ...base,
      userTurns: [{ id: "turn-1", content: "We sell business software to agencies and want 120 signals." }],
      fieldSupports: base.fieldSupports.map(item => item.field === "markets"
        ? { ...item, quote: "business" }
        : item.field === "requestedConfirmedSignals" ? { ...item, quote: "120" } : item),
    }).success).toBe(false);
  });
});
