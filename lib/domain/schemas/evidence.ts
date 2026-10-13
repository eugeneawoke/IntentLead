import { z } from "zod";
import {
  ConfidenceSchema, ContentHashSchema, HttpUrlSchema, IdSchema, JurisdictionSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

const SourceMeasurementSchema = z.discriminatedUnion("metric", [
  z.object({
    metric: z.enum(["REVIEW_COUNT", "MENTION_COUNT", "CITATION_COUNT", "OBSERVATION_COUNT"]),
    value: z.number().int().nonnegative(), observedAt: TimestampSchema,
  }).strict(),
  z.object({ metric: z.literal("SEARCH_RANK"), value: z.number().int().positive(), observedAt: TimestampSchema }).strict(),
  z.object({ metric: z.literal("HTTP_STATUS"), value: z.number().int().min(100).max(599), observedAt: TimestampSchema }).strict(),
  z.object({
    metric: z.literal("REVIEW_RATING"), value: z.number().finite().nonnegative(),
    scaleMax: z.number().finite().positive(), observedAt: TimestampSchema,
  }).strict(),
]).refine(item => item.metric !== "REVIEW_RATING" || item.value <= item.scaleMax, "Rating exceeds its stated scale");

// Version 1 is a closed normalized vocabulary. New facts require a schema revision;
// provider-native fields remain behind provenance/artifact references.
export const StructuredFactSchema = z.object({
  companyName: NonEmptyStringSchema.optional(),
  companyDomain: z.string().max(253).regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i).optional(),
  employeeCount: z.number().int().nonnegative().optional(),
  technologies: z.array(NonEmptyStringSchema).nonempty().optional(),
  location: JurisdictionSchema.extend({ locality: NonEmptyStringSchema.nullable() }).optional(),
  problem: z.object({
    category: z.enum(["website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations"]),
    observedCondition: NonEmptyStringSchema,
  }).strict().optional(),
  sourceMeasurement: SourceMeasurementSchema.optional(),
}).strict();
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
  structuredFacts: StructuredFactSchema,
  provenance: ProvenanceSchema,
  jurisdiction: JurisdictionSchema.nullable(),
};

export const SourceItemSchema = z.object({
  ...observationShape,
  externalId: IdSchema,
  publishedAt: TimestampSchema.nullable(),
  content: NonEmptyStringSchema.nullable(),
}).strict().refine(
  item => item.content !== null || Object.values(item.structuredFacts).some(value => value !== undefined) || item.provenance.rawArtifactId !== null,
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
  item => item.excerpt !== null || Object.values(item.structuredFacts).some(value => value !== undefined) || item.provenance.rawArtifactId !== null,
  "Evidence needs an excerpt, normalized facts or an artifact",
);
