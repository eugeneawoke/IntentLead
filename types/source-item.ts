import type { z } from "zod";
import type { SourceItemSchema } from "../lib/domain/schemas/evidence";

export type SourceItem = z.infer<typeof SourceItemSchema>;
