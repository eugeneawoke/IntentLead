import type { z } from "zod";
import type {
  BusinessTypeSchema,
  SourceCatalogEntrySchema,
  SourcePlanRequestSchema,
  SourcePlanSchema,
} from "../lib/domain/schemas/source-plan";

export type BusinessType = z.infer<typeof BusinessTypeSchema>;
export type SourceCatalogEntry = z.infer<typeof SourceCatalogEntrySchema>;
export type SourcePlanRequest = z.infer<typeof SourcePlanRequestSchema>;
export type SourcePlan = z.infer<typeof SourcePlanSchema>;
