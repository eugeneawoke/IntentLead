import { z } from "zod";
import {
  ConfidenceSchema, EvidenceIdsSchema, IdSchema, JurisdictionSchema, MarketProfileIdSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

export const SignalSchema = z.discriminatedUnion("family", [
  z.object({ family: z.literal("EXPRESSED_INTENT"), subtype: z.enum([
    "recommendation_request", "comparison", "switching", "complaint", "solution_search", "rfp",
  ]) }).strict(),
  z.object({ family: z.literal("TRIGGER_EVENT"), subtype: z.enum([
    "hiring", "funding", "launch", "expansion", "leadership_change", "technology_change",
  ]) }).strict(),
  z.object({ family: z.literal("DETECTED_PROBLEM"), subtype: z.enum([
    "website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations",
  ]) }).strict(),
  z.object({ family: z.literal("VISIBILITY_FINDING"), subtype: z.enum([
    "ai_visibility", "citation_gap", "competitor_overtake", "local_visibility",
  ]) }).strict(),
]);

const assessmentShape = {
  ...ScopedRecordShape, opportunityId: IdSchema, assessedAt: TimestampSchema, modelRunId: IdSchema,
  signal: SignalSchema, problemType: NonEmptyStringSchema, problemStatement: NonEmptyStringSchema,
  evidenceStrength: ConfidenceSchema, explicitness: ConfidenceSchema, urgency: ConfidenceSchema,
  freshness: ConfidenceSchema, commercialImpact: ConfidenceSchema, icpFit: ConfidenceSchema,
  companyConfidence: ConfidenceSchema, buyerRelevance: ConfidenceSchema, actionability: ConfidenceSchema,
  confidence: ConfidenceSchema, evidenceIds: EvidenceIdsSchema,
};
export const OpportunityAssessmentSchema = z.discriminatedUnion("decision", [
  z.object({ ...assessmentShape, decision: z.literal("QUALIFY"), rejectionReasons: z.tuple([]) }).strict(),
  z.object({ ...assessmentShape, decision: z.literal("REVIEW"), rejectionReasons: z.tuple([]), reviewReasons: z.array(NonEmptyStringSchema).nonempty() }).strict(),
  z.object({ ...assessmentShape, decision: z.literal("REJECT"), rejectionReasons: z.array(NonEmptyStringSchema).nonempty() }).strict(),
]);

export const OpportunityStateSchema = z.enum([
  "DISCOVERED", "ENRICHING", "ASSESSABLE", "INSUFFICIENT_EVIDENCE", "PACKAGE_READY", "MODEL_REJECTED",
  "HUMAN_REVIEW", "OUTREACH_READY", "REJECTED", "NEEDS_RESEARCH", "CONTACTED", "REPLIED", "NO_REPLY",
  "OPTED_OUT", "POSITIVE_REPLY", "NEGATIVE_REPLY", "MEETING", "SALES_OPPORTUNITY", "CUSTOMER", "CLOSED",
]);
const discoveryStates = OpportunityStateSchema.extract([
  "DISCOVERED", "ENRICHING", "ASSESSABLE", "INSUFFICIENT_EVIDENCE", "PACKAGE_READY", "MODEL_REJECTED",
  "HUMAN_REVIEW", "REJECTED", "NEEDS_RESEARCH",
]);

export const OpportunitySchema = z.object({
  ...ScopedRecordShape, discoveryBriefId: IdSchema, companyId: IdSchema.nullable(),
  marketProfileId: MarketProfileIdSchema, jurisdiction: JurisdictionSchema.nullable(),
  signal: SignalSchema, state: OpportunityStateSchema, evidenceIds: EvidenceIdsSchema,
  assessmentId: IdSchema.nullable(), createdAt: TimestampSchema, updatedAt: TimestampSchema,
}).strict().refine(
  item => item.marketProfileId !== "EN_DISCOVERY_ONLY" || discoveryStates.safeParse(item.state).success,
  "Discovery-only opportunities cannot enter contact or outreach states",
).refine(item => Date.parse(item.updatedAt) >= Date.parse(item.createdAt), "updatedAt precedes createdAt");
