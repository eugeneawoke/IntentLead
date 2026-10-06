import { z } from "zod";
import { IdSchema, NonEmptyStringSchema, ScopedRecordShape, TimestampSchema } from "./common";

const ReviewReasonSchema = z.enum([
  "WRONG_COMPANY", "WEAK_SIGNAL", "NOT_RELEVANT", "TOO_OLD", "ALREADY_SOLVED",
  "DUPLICATE", "POOR_OFFER_FIT", "POOR_ICP_FIT", "LOW_COMMERCIAL_IMPACT",
  "BAD_TIMING", "UNSUPPORTED_INFERENCE", "POLICY_CONCERN", "OTHER",
]);
const reviewShape = {
  ...ScopedRecordShape, opportunityId: IdSchema, reviewerId: IdSchema,
  reviewedAt: TimestampSchema, note: NonEmptyStringSchema.nullable(),
};
export const ReviewDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ ...reviewShape, decision: z.literal("ACCEPTED"), reason: z.literal("RELEVANT") }).strict(),
  z.object({ ...reviewShape, decision: z.literal("REJECTED"), reason: ReviewReasonSchema }).strict(),
  z.object({ ...reviewShape, decision: z.literal("NEEDS_RESEARCH"), reason: ReviewReasonSchema }).strict(),
]).refine(review => review.reason !== "OTHER" || review.note !== null, "OTHER requires a reviewer note");
