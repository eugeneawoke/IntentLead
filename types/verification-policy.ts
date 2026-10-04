import type { z } from "zod";
import type { VerificationPolicySchema, PackageVerificationResultSchema } from "../lib/domain/schemas/verification-policy";

export type VerificationPolicy = z.infer<typeof VerificationPolicySchema>;
export type PackageVerificationResult = z.infer<typeof PackageVerificationResultSchema>;
