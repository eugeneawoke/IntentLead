import { MarketProfileSchema } from "./schemas/market-profile";
import type { Capability, MarketProfile } from "../../types/market-profile";
import type { SelfProspectingPolicy, SelfProspectingReasonCode } from "../../types/self-prospecting";
import type { OpportunityAssessmentOutput } from "../ai/schemas/opportunity-assessment";
import type { OpportunitySignal } from "../../types/opportunity";

const discoveryCapabilities = new Set<Capability>([
  "SOURCE_SEARCH", "WEB_FETCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW",
]);

export const DEFAULT_SELF_PROSPECTING_POLICY: SelfProspectingPolicy = {
  maxCandidates: 20,
  maxSignalAgeDays: {
    EXPRESSED_INTENT: 90, TRIGGER_EVENT: 180, DETECTED_PROBLEM: 30, VISIBILITY_FINDING: 14,
  },
  minimumEvidenceItems: 1,
  minimumCompanyConfidence: 0.72,
  minimumEvidenceStrength: 0.6,
  minimumExplicitness: 0.6,
  minimumIcpFit: 0.6,
  minimumActionability: 0.5,
  minimumConfidence: 0.55,
  assessmentCost: { amount: 0, currency: "USD" },
};

export function authorizeSelfProspectingCapability(
  profileInput: MarketProfile | unknown,
  capability: Capability,
): { allowed: boolean; reason: "ALLOWED" | "INVALID_PROFILE" | "PROFILE_MISMATCH" | "CAPABILITY_DISABLED" } {
  const parsed = MarketProfileSchema.safeParse(profileInput);
  if (!parsed.success) return { allowed: false, reason: "INVALID_PROFILE" };
  if (parsed.data.id !== "EN_DISCOVERY_ONLY" || parsed.data.workflow !== "DISCOVERY_ONLY") {
    return { allowed: false, reason: "PROFILE_MISMATCH" };
  }
  const allowed = discoveryCapabilities.has(capability)
    && parsed.data.capabilities.some(item => item === capability)
    && !parsed.data.disabledCapabilities.some(item => item === capability);
  return { allowed, reason: allowed ? "ALLOWED" : "CAPABILITY_DISABLED" };
}

export interface OpportunityPolicyEvaluation {
  state: "HUMAN_REVIEW" | "MODEL_REJECTED";
  decision: OpportunityAssessmentOutput["decision"];
  reasons: SelfProspectingReasonCode[];
  freshness: number;
}

export function evaluateOpportunityPolicy(input: {
  signal: OpportunitySignal;
  publishedAt: string | null;
  now: Date;
  companyConfidence: number;
  assessment: OpportunityAssessmentOutput;
  policy: SelfProspectingPolicy;
}): OpportunityPolicyEvaluation {
  const maxAge = input.policy.maxSignalAgeDays[input.signal.family] ?? 30;
  const age = input.publishedAt ? Math.max(0, input.now.getTime() - Date.parse(input.publishedAt)) / 86_400_000 : Infinity;
  const freshness = Number.isFinite(age) ? Math.max(0, Math.min(1, 1 - age / maxAge)) : 0;
  const reasons: SelfProspectingReasonCode[] = [];
  if (freshness === 0) reasons.push("SIGNAL_TOO_OLD");
  if (input.companyConfidence < input.policy.minimumCompanyConfidence) reasons.push("LOW_COMPANY_CONFIDENCE");
  if (input.assessment.decision === "REJECT") {
    return { state: "MODEL_REJECTED", decision: "REJECT", reasons: ["MODEL_REJECTED"], freshness };
  }
  if (input.assessment.decision === "REVIEW") reasons.push("MODEL_REVIEW");
  if (input.signal.family === "EXPRESSED_INTENT" && input.assessment.explicitness < input.policy.minimumExplicitness) reasons.push("LOW_EXPLICITNESS");
  if (input.assessment.evidenceStrength < input.policy.minimumEvidenceStrength) reasons.push("LOW_EVIDENCE_STRENGTH");
  if (input.assessment.icpFit < input.policy.minimumIcpFit) reasons.push("LOW_ICP_FIT");
  if (input.assessment.actionability < input.policy.minimumActionability) reasons.push("LOW_ACTIONABILITY");
  if (input.assessment.confidence < input.policy.minimumConfidence) reasons.push("LOW_CONFIDENCE");
  if (reasons.length === 0) reasons.push("POLICY_REVIEW_REQUIRED");
  return { state: "HUMAN_REVIEW", decision: "REVIEW", reasons, freshness };
}
