import type { z } from "zod";
import type { EvidenceItemSchema, ProvenanceSchema, StructuredFactSchema } from "../lib/domain/schemas/evidence";

export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;
export type EvidenceProvenance = z.infer<typeof ProvenanceSchema>;
export type StructuredFact = z.infer<typeof StructuredFactSchema>;
