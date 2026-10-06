import { z } from "zod";
import {
  ConfidenceSchema, EvidenceIdsSchema, IdSchema, JurisdictionSchema, MarketProfileIdSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

export const SignalSchema = z.discriminatedUnion("family", [
  z.object({ family: z.literal("EXPRESSED_INTENT"), subtype: z.enum([
    "recommendation_request", "comparison", "switching", "complaint", "solution_search", "rfp",
  ]) }).strict(),
  z.object({ family: z.literal("BUSINESS_EVENT"), subtype: z.enum([
    "hiring", "funding", "launch", "expansion", "leadership_change", "technology_change",
  ]) }).strict(),
  z.object({ family: z.literal("DETECTED_PROBLEM"), subtype: z.enum([
    "operations", "acquisition", "conversion", "reputation", "customer_experience", "market_presence",
  ]) }).strict(),
  z.object({ family: z.literal("MARKET_OBSERVATION"), subtype: z.enum([
    "competitor_change", "review_pattern", "category_gap", "local_presence", "visibility_gap",
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

const opportunityShape = {
  ...ScopedRecordShape, discoveryBriefId: IdSchema,
  marketProfileId: MarketProfileIdSchema, jurisdiction: JurisdictionSchema.nullable(),
  signal: SignalSchema, evidenceIds: EvidenceIdsSchema, createdAt: TimestampSchema, updatedAt: TimestampSchema,
};
const incompleteStates = OpportunityStateSchema.extract(["DISCOVERED", "ENRICHING", "INSUFFICIENT_EVIDENCE"]);
const assessedStates = OpportunityStateSchema.exclude([...incompleteStates.options, "ASSESSABLE"]);

// Snapshot requirements only; transition authorization belongs to application commands.
export const OpportunitySchema = z.discriminatedUnion("state", [
  z.object({ ...opportunityShape, state: incompleteStates, companyId: IdSchema.nullable(), assessmentId: IdSchema.nullable() }).strict(),
  z.object({ ...opportunityShape, state: z.literal("ASSESSABLE"), companyId: IdSchema, assessmentId: IdSchema.nullable() }).strict(),
  z.object({ ...opportunityShape, state: assessedStates, companyId: IdSchema, assessmentId: IdSchema }).strict(),
]).refine(
  item => item.marketProfileId !== "EN_DISCOVERY_ONLY" || discoveryStates.safeParse(item.state).success,
  "Discovery-only opportunities cannot enter contact or outreach states",
).refine(item => Date.parse(item.updatedAt) >= Date.parse(item.createdAt), "updatedAt precedes createdAt");
