import type { z } from "zod";
import type { ReviewDecisionSchema, OutcomeSchema } from "../lib/domain/schemas/review-outcome";

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
export type Outcome = z.infer<typeof OutcomeSchema>;
