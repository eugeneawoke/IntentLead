import type { z } from "zod";
import type { SuppressionEntrySchema } from "../lib/domain/schemas/governance";

export type SuppressionEntry = z.infer<typeof SuppressionEntrySchema>;
