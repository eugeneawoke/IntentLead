import type { z } from "zod";
import type { JobSchema, CapabilityErrorSchema } from "../lib/domain/schemas/job";

export type Job = z.infer<typeof JobSchema>;
export type CapabilityError = z.infer<typeof CapabilityErrorSchema>;
