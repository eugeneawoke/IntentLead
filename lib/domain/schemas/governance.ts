import { z } from "zod";
import { ContentHashSchema, IdSchema, NonEmptyStringSchema, ScopedRecordShape, TimestampSchema } from "./common";

export const SuppressionEntrySchema = z.object({
  ...ScopedRecordShape, identifierType: z.enum(["EMAIL", "PHONE", "PROFILE", "PERSON", "COMPANY"]),
  identifierHash: ContentHashSchema, reason: z.enum(["OPT_OUT", "COMPLAINT", "POLICY"]),
  policyId: IdSchema, createdAt: TimestampSchema, retainUntil: TimestampSchema.nullable(),
}).strict().refine(
  item => item.retainUntil === null || Date.parse(item.retainUntil) >= Date.parse(item.createdAt),
  "Suppression retention precedes creation",
);
export const ArtifactMetadataSchema = z.object({
  ...ScopedRecordShape, sourceItemId: IdSchema.nullable(), contentHash: ContentHashSchema,
  storageReference: NonEmptyStringSchema, mediaType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  sizeBytes: z.number().int().nonnegative(), access: z.literal("WORKSPACE_PRIVATE"),
  retentionPolicyId: IdSchema, createdAt: TimestampSchema, expiresAt: TimestampSchema.nullable(),
}).strict().refine(
  item => item.expiresAt === null || Date.parse(item.expiresAt) >= Date.parse(item.createdAt),
  "Artifact expiry precedes creation",
);
