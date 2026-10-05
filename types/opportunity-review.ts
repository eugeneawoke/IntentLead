import type { z } from "zod";
import type {
  OpportunityReviewCommandSchema,
  OpportunityReviewDetailSchema,
  OpportunityReviewEvidenceSchema,
  OpportunityReviewListItemSchema,
  OpportunityReviewListSchema,
  OpportunityReviewResultSchema,
} from "../lib/domain/schemas/opportunity-review";

export type OpportunityReviewCommand = z.infer<typeof OpportunityReviewCommandSchema>;
export type OpportunityReviewEvidence = z.infer<typeof OpportunityReviewEvidenceSchema>;
export type OpportunityReviewListItem = z.infer<typeof OpportunityReviewListItemSchema>;
export type OpportunityReviewList = z.infer<typeof OpportunityReviewListSchema>;
export type OpportunityReviewDetail = z.infer<typeof OpportunityReviewDetailSchema>;
export type OpportunityReviewResult = z.infer<typeof OpportunityReviewResultSchema>;
