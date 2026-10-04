import { z } from "zod";
import { ChannelSchema, IdSchema, NonEmptyStringSchema, ScopedRecordShape, TimestampSchema } from "./common";

const ReviewReasonSchema = z.enum([
  "WRONG_COMPANY", "WRONG_PERSON", "WEAK_SIGNAL", "NOT_RELEVANT", "TOO_OLD", "ALREADY_SOLVED",
  "INVALID_CONTACT", "DUPLICATE", "POLICY_CONCERN", "OTHER",
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

const outcomeShape = {
  ...ScopedRecordShape, opportunityId: IdSchema, recordedBy: IdSchema, occurredAt: TimestampSchema,
  marketProfileId: z.enum(["CIS_RU", "LOCAL_CUSTOM"]),
};
// Observation records are separate from assessment/review; these do not send messages.
export const OutcomeSchema = z.discriminatedUnion("type", [
  z.object({ ...outcomeShape, type: z.literal("CONTACTED"), contactPointId: IdSchema, channel: ChannelSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("REPLIED"), contactPointId: IdSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("NO_REPLY") }).strict(),
  z.object({ ...outcomeShape, type: z.literal("OPTED_OUT"), suppressionEntryId: IdSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("POSITIVE_REPLY"), contactPointId: IdSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("NEGATIVE_REPLY"), contactPointId: IdSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("MEETING"), scheduledAt: TimestampSchema }).strict(),
  z.object({ ...outcomeShape, type: z.literal("SALES_OPPORTUNITY") }).strict(),
  z.object({ ...outcomeShape, type: z.literal("CUSTOMER") }).strict(),
  z.object({ ...outcomeShape, type: z.literal("CLOSED"), reason: NonEmptyStringSchema }).strict(),
]);
