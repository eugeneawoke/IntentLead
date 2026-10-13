import { z } from "zod";
import { ConfidenceSchema, TimestampSchema } from "./common";
import { SignalSchema } from "./opportunity";

const ExistingReviewReasonSchema = z.enum([
  "WRONG_COMPANY", "WEAK_SIGNAL", "NOT_RELEVANT", "TOO_OLD", "ALREADY_SOLVED",
  "DUPLICATE", "POOR_OFFER_FIT", "POOR_ICP_FIT", "LOW_COMMERCIAL_IMPACT",
  "BAD_TIMING", "UNSUPPORTED_INFERENCE", "POLICY_CONCERN", "OTHER",
]);

// Block URL-shaped domain/path tokens, but preserve plain domains and ordinary prose.
// This is a narrow contact-link heuristic, not generic person or role de-identification.
const protocolLessDomainPathPattern = /(?:^|[^A-Za-z0-9@_-])(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?\/[^ \t\n\r]*/i;

const ReviewNoteSchema = z.string().trim().min(1).max(500).nullable().refine(
  value => value === null || (
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i.test(value)
    && !/(?:https?:\/\/|www\.)/i.test(value)
    && !protocolLessDomainPathPattern.test(value)
    && !/@[A-Za-z0-9_]{2,}/.test(value)
    && !/(?<!\d)\+?\d[\d(). -]{7,}\d(?!\d)/.test(value)
  ),
  "Review notes cannot contain contact details",
);

const IdempotencyKeySchema = z.string().min(12).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const reviewCommandFields = {
  note: ReviewNoteSchema,
  idempotencyKey: IdempotencyKeySchema,
};

export const OpportunityReviewCommandSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("ACCEPTED"), reason: z.literal("RELEVANT"), ...reviewCommandFields }).strict(),
  z.object({ decision: z.literal("REJECTED"), reason: ExistingReviewReasonSchema, ...reviewCommandFields }).strict(),
  z.object({ decision: z.literal("NEEDS_RESEARCH"), reason: ExistingReviewReasonSchema, ...reviewCommandFields }).strict(),
]).superRefine((command, context) => {
  if (command.reason === "OTHER" && command.note === null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["note"], message: "OTHER requires a note" });
  }
});

export const ReviewOpportunityStateSchema = z.enum(["HUMAN_REVIEW", "ACCEPTED", "REJECTED", "NEEDS_RESEARCH"]);

const ReviewCompanySchema = z.object({
  name: z.string().trim().min(1).max(253),
  domain: z.string().trim().min(1).max(253).nullable(),
  confidence: ConfidenceSchema,
}).strict();

const SafeReviewTextSchema = (maximum: number) => z.string().trim().min(1).max(maximum).refine(
  value => !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i.test(value)
    && !/(?:https?:\/\/|www\.)/i.test(value)
    && !protocolLessDomainPathPattern.test(value)
    && !/@[A-Za-z0-9_]{2,}/.test(value)
    && !/(?<!\d)\+?\d[\d(). -]{7,}\d(?!\d)/.test(value),
  "Text cannot contain contact details",
);

const ReviewAssessmentSchema = z.object({
  decision: z.enum(["QUALIFY", "REVIEW", "REJECT"]),
  confidence: ConfidenceSchema,
  evidenceStrength: ConfidenceSchema,
  freshness: ConfidenceSchema,
  commercialImpact: ConfidenceSchema,
  icpFit: ConfidenceSchema,
  actionability: ConfidenceSchema,
  problemStatement: SafeReviewTextSchema(600).nullable().optional(),
}).strict();

const ReviewSummarySchema = z.object({
  id: z.string().uuid(),
  state: ReviewOpportunityStateSchema,
  signal: SignalSchema,
  company: ReviewCompanySchema.nullable(),
  assessment: ReviewAssessmentSchema.nullable(),
  evidenceCount: z.number().int().nonnegative(),
  evidenceStatus: z.enum(["COMPLETE", "PARTIAL", "MISSING"]),
  latestReview: z.object({
    decision: z.enum(["ACCEPTED", "REJECTED", "NEEDS_RESEARCH"]),
    reviewedAt: TimestampSchema,
  }).strict().nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).strict();

export const OpportunityReviewEvidenceFactsSchema = z.object({
  companyName: z.string().trim().min(1).max(253).optional(),
  companyDomain: z.string().trim().min(1).max(253).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  technologies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  location: z.object({
    countryCode: z.string().regex(/^[A-Z]{2}$/),
    subdivisionCode: z.string().trim().min(1).nullable().optional(),
    locality: z.string().trim().min(1).nullable().optional(),
  }).strict().optional(),
  observedCondition: SafeReviewTextSchema(500).optional(),
  problemCategory: z.enum(["website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations"]).optional(),
  problem: z.object({
    category: z.enum(["website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations"]).optional(),
    observedCondition: SafeReviewTextSchema(500).optional(),
  }).strict().optional(),
  measurement: z.object({
    metric: z.enum(["REVIEW_COUNT", "MENTION_COUNT", "CITATION_COUNT", "OBSERVATION_COUNT", "SEARCH_RANK", "HTTP_STATUS", "REVIEW_RATING"]),
    value: z.number().finite(),
    observedAt: TimestampSchema,
  }).strict().optional(),
}).strict();

export const OpportunityReviewEvidenceSchema = z.object({
  id: z.string().uuid(),
  sourceUrl: z.string().url().nullable(),
  provider: z.string().trim().min(1).max(80),
  capturedAt: TimestampSchema,
  confidence: ConfidenceSchema,
  verificationMethod: z.string().trim().min(1).max(120),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i),
  facts: OpportunityReviewEvidenceFactsSchema,
}).strict();

export const OpportunityReviewListItemSchema = ReviewSummarySchema;
export const OpportunityReviewDetailSchema = ReviewSummarySchema.extend({
  evidence: z.array(OpportunityReviewEvidenceSchema),
  limitations: z.array(z.string().trim().min(1).max(240)).max(12),
}).strict();

export const OpportunityReviewListSchema = z.object({
  items: z.array(OpportunityReviewListItemSchema).max(50),
  nextCursor: z.string().max(400).nullable(),
  hasMore: z.boolean(),
}).strict();

export const OpportunityReviewResultSchema = z.object({
  opportunityId: z.string().uuid(),
  state: ReviewOpportunityStateSchema,
  decision: z.enum(["ACCEPTED", "REJECTED", "NEEDS_RESEARCH"]),
  reason: z.string().trim().min(1).max(80),
  reviewedAt: TimestampSchema,
  replayed: z.boolean(),
}).strict();
