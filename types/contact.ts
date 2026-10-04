import type { z } from "zod";
import type { ContactPointSchema, ContactVerificationSchema, ContactVerificationStatusSchema } from "../lib/domain/schemas/person-contact";

export type ContactPoint = z.infer<typeof ContactPointSchema>;
export type ContactVerification = z.infer<typeof ContactVerificationSchema>;
export type ContactVerificationStatus = z.infer<typeof ContactVerificationStatusSchema>;
