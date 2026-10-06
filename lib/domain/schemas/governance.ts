import { z } from "zod";
import { ContentHashSchema, IdSchema, NonEmptyStringSchema, ScopedRecordShape, TimestampSchema } from "./common";

export const ArtifactMetadataSchema = z.object({
  ...ScopedRecordShape, sourceItemId: IdSchema.nullable(), contentHash: ContentHashSchema,
  storageReference: NonEmptyStringSchema, mediaType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
  sizeBytes: z.number().int().nonnegative(), access: z.literal("WORKSPACE_PRIVATE"),
  retentionPolicyId: IdSchema, createdAt: TimestampSchema, expiresAt: TimestampSchema.nullable(),
}).strict().refine(
  item => item.expiresAt === null || Date.parse(item.expiresAt) >= Date.parse(item.createdAt),
  "Artifact expiry precedes creation",
);
