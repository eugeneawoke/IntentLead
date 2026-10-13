import { fingerprintConversationalIntakeReview } from "@/lib/application/conversational-intake-approval";
import type { ConversationalIntakeReview } from "@/types/conversational-intake";

const prompt = {
  templateId: "intake-v1", version: "1", systemInstructionHash: "a".repeat(64),
  userContentRole: "UNTRUSTED_USER" as const,
};
const telemetry = {
  model: "fixture", modelVersion: "fixture-v1", inputTokens: 20, outputTokens: 30, latencyMs: 0,
  cost: { amount: 0, currency: "USD" }, limitations: ["SYNTHETIC_FIXTURE"],
};
const turn = "We sell workflow software for faster delivery to US agencies. Buyers are operations leaders. Markets US and Canada. Languages English and French. Exclude gambling. Need 30 confirmed signals.";

export const conversationalIntakeReview: ConversationalIntakeReview = {
  schemaVersion: 1,
  state: "READY_FOR_REVIEW",
  requestFingerprint: "b".repeat(64),
  userTurns: [{ id: "turn-1", content: turn }],
  intake: {
    offerSummary: "workflow software", desiredOutcomes: ["faster delivery"],
    targetCompanyDescription: "US agencies", targetBuyerDescription: "operations leaders",
    markets: ["US", "Canada"], languages: ["English", "French"], exclusions: ["gambling"],
    requestedConfirmedSignals: 30, missingRequiredFields: [], assumptionsForReview: [],
    ambiguitiesForClarification: [],
  },
  fieldSupports: [
    { field: "offerSummary", value: "workflow software", turnId: "turn-1", quote: "workflow software" },
    { field: "desiredOutcomes", value: "faster delivery", turnId: "turn-1", quote: "faster delivery" },
    { field: "targetCompanyDescription", value: "US agencies", turnId: "turn-1", quote: "US agencies" },
    { field: "targetBuyerDescription", value: "operations leaders", turnId: "turn-1", quote: "operations leaders" },
    { field: "markets", value: "US", turnId: "turn-1", quote: "Markets US" },
    { field: "markets", value: "Canada", turnId: "turn-1", quote: "Canada" },
    { field: "languages", value: "English", turnId: "turn-1", quote: "Languages English" },
    { field: "languages", value: "French", turnId: "turn-1", quote: "French" },
    { field: "exclusions", value: "gambling", turnId: "turn-1", quote: "Exclude gambling" },
    { field: "requestedConfirmedSignals", value: 30, turnId: "turn-1", quote: "30 confirmed signals" },
  ],
  clarificationQuestions: [], telemetry, prompt,
};

export function conversationalIntakeApproval(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    review: conversationalIntakeReview,
    submittedReviewFingerprint: fingerprintConversationalIntakeReview(conversationalIntakeReview),
    humanApproved: true,
    names: { offer: "Workflow offer", icp: "Agency ICP" },
    objective: "Find evidence-backed agency opportunities",
    companyAttributes: [],
    marketMappings: [
      { marketIntent: "US", scope: "JURISDICTIONS", jurisdictions: [{ countryCode: "US", subdivisionCode: null }] },
      { marketIntent: "Canada", scope: "JURISDICTIONS", jurisdictions: [{ countryCode: "CA", subdivisionCode: null }] },
    ],
    languageMappings: [
      { source: "USER_STATED", languageIntent: "English", language: "en" },
      { source: "USER_STATED", languageIntent: "French", language: "fr" },
    ],
    exclusionMappings: [{ exclusion: "gambling", destination: "DISCOVERY" }],
    executionCriteria: {
      jurisdictions: [{ countryCode: "US", subdivisionCode: null }, { countryCode: "CA", subdivisionCode: null }],
      languages: ["en", "fr"], signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT"],
      requestedConfirmedSignals: 30, limits: { maxSourceItems: 80, maxOpportunities: 15 },
    },
    ...overrides,
  };
}
