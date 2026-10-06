import type { z } from "zod";
import type { ReviewDecisionSchema } from "../lib/domain/schemas/review-outcome";

export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;
