import { z } from "zod";
import { ConfidenceSchema, EvidenceIdsSchema, NonEmptyStringSchema } from "../../domain/schemas/common";

const ReasonCodeSchema = z.enum([
  "WRONG_COMPANY", "TOO_OLD", "WEAK_SIGNAL", "NOT_RELEVANT", "ALREADY_SOLVED",
  "POLICY_CONCERN", "NEEDS_HUMAN_CONFIRMATION", "OTHER",
]);
const EvidenceClaimSchema = z.object({
  text: NonEmptyStringSchema.max(500),
  evidenceIds: EvidenceIdsSchema.max(8),
}).strict().refine(claim => claim.evidenceIds.length === new Set(claim.evidenceIds).size, "Claim evidence references must be unique");

const outputShape = {
  problemType: z.enum(["website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations", "other"]),
  problemStatement: NonEmptyStringSchema.max(500),
  evidenceStrength: ConfidenceSchema,
  explicitness: ConfidenceSchema,
  urgency: ConfidenceSchema,
  commercialImpact: ConfidenceSchema,
  icpFit: ConfidenceSchema,
  buyerRelevance: ConfidenceSchema,
  actionability: ConfidenceSchema,
  confidence: ConfidenceSchema,
  evidenceIds: EvidenceIdsSchema.max(16),
  groundedClaims: z.array(EvidenceClaimSchema).min(1).max(8),
};

export const OpportunityAssessmentOutputSchema = z.discriminatedUnion("decision", [
  z.object({ ...outputShape, decision: z.literal("QUALIFY"), rejectionReasons: z.tuple([]), reviewReasons: z.tuple([]) }).strict(),
  z.object({ ...outputShape, decision: z.literal("REVIEW"), rejectionReasons: z.tuple([]), reviewReasons: z.array(ReasonCodeSchema).nonempty().max(6) }).strict(),
  z.object({ ...outputShape, decision: z.literal("REJECT"), rejectionReasons: z.array(ReasonCodeSchema).nonempty().max(6), reviewReasons: z.tuple([]) }).strict(),
]).superRefine((assessment, ctx) => {
  if (assessment.evidenceIds.length !== new Set(assessment.evidenceIds).size) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Evidence references must be unique" });
  }
});

export type OpportunityAssessmentOutput = z.infer<typeof OpportunityAssessmentOutputSchema>;
