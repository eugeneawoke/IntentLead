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

const opportunityShape = {
  ...ScopedRecordShape, discoveryBriefId: IdSchema,
  marketProfileId: MarketProfileIdSchema, jurisdiction: JurisdictionSchema.nullable(),
  signal: SignalSchema, evidenceIds: EvidenceIdsSchema, createdAt: TimestampSchema, updatedAt: TimestampSchema,
};
const incompleteStates = OpportunityStateSchema.extract(["DISCOVERED", "ENRICHING", "INSUFFICIENT_EVIDENCE"]);
const assessedStates = OpportunityStateSchema.exclude([...incompleteStates.options, "ASSESSABLE", "MODEL_REJECTED"]);

// Snapshot requirements only; transition authorization belongs to application commands.
export const OpportunitySchema = z.discriminatedUnion("state", [
  z.object({ ...opportunityShape, state: incompleteStates, companyId: IdSchema.nullable(), assessmentId: IdSchema.nullable() }).strict(),
  z.object({ ...opportunityShape, state: z.literal("ASSESSABLE"), companyId: IdSchema, assessmentId: IdSchema.nullable() }).strict(),
  // A model can reject a candidate because company resolution failed.
  z.object({ ...opportunityShape, state: z.literal("MODEL_REJECTED"), companyId: IdSchema.nullable(), assessmentId: IdSchema }).strict(),
  z.object({ ...opportunityShape, state: assessedStates, companyId: IdSchema, assessmentId: IdSchema }).strict(),
]).refine(
  item => item.marketProfileId !== "EN_DISCOVERY_ONLY" || discoveryStates.safeParse(item.state).success,
  "Discovery-only opportunities cannot enter contact or outreach states",
).refine(item => Date.parse(item.updatedAt) >= Date.parse(item.createdAt), "updatedAt precedes createdAt");
