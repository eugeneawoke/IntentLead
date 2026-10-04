import { z } from "zod";
import {
  ConfidenceSchema, ContentHashSchema, HttpUrlSchema, IdSchema, JurisdictionSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

// Adapters normalize facts; raw vendor documents live behind an artifact reference.
export const StructuredFactSchema = z.union([z.string(), z.number().finite(), z.boolean(), z.null()]);
export const ProvenanceSchema = z.object({
  sourceType: z.enum(["WEB", "SOCIAL", "DIRECTORY", "DOCUMENT", "MEASUREMENT", "HUMAN"]),
  sourceId: IdSchema,
  providerRunId: IdSchema.nullable(),
  rawArtifactId: IdSchema.nullable(),
}).strict();
const observationShape = {
  ...ScopedRecordShape,
  sourceUrl: HttpUrlSchema.nullable(),
  capturedAt: TimestampSchema,
  contentHash: ContentHashSchema,
  structuredFacts: z.record(NonEmptyStringSchema, StructuredFactSchema),
  provenance: ProvenanceSchema,
  jurisdiction: JurisdictionSchema.nullable(),
};

export const SourceItemSchema = z.object({
  ...observationShape,
  externalId: IdSchema,
  publishedAt: TimestampSchema.nullable(),
  content: NonEmptyStringSchema.nullable(),
}).strict().refine(
  item => item.content !== null || Object.keys(item.structuredFacts).length > 0 || item.provenance.rawArtifactId !== null,
  "A source item needs content, normalized facts or an artifact",
);

export const EvidenceItemSchema = z.object({
  ...observationShape,
  sourceItemId: IdSchema.nullable(),
  type: z.enum(["text", "structured_fact", "screenshot", "document", "observation"]),
  excerpt: NonEmptyStringSchema.nullable(),
  verificationMethod: NonEmptyStringSchema,
  confidence: ConfidenceSchema,
}).strict().refine(
  item => item.excerpt !== null || Object.keys(item.structuredFacts).length > 0 || item.provenance.rawArtifactId !== null,
  "Evidence needs an excerpt, normalized facts or an artifact",
);
