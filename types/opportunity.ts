import type { z } from "zod";
import type { OpportunitySchema, OpportunityAssessmentSchema, OpportunityStateSchema, SignalSchema } from "../lib/domain/schemas/opportunity";

export type Opportunity = z.infer<typeof OpportunitySchema>;
export type OpportunityAssessment = z.infer<typeof OpportunityAssessmentSchema>;
export type OpportunityState = z.infer<typeof OpportunityStateSchema>;
export type OpportunitySignal = z.infer<typeof SignalSchema>;
