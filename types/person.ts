import type { z } from "zod";
import type { BuyerCandidateSchema, PersonSchema } from "../lib/domain/schemas/person-contact";

export type Person = z.infer<typeof PersonSchema>;
export type BuyerCandidate = z.infer<typeof BuyerCandidateSchema>;
