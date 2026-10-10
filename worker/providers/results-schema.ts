import { z } from "zod";
import { CapabilityErrorSchema } from "../../lib/domain/schemas/job";
import { PROVIDER_SCHEMA_VERSION } from "./contracts";

const ProviderIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_]{0,63}$/);
const FailureKindSchema = z.enum([
  "MALFORMED_RESPONSE", "UNAUTHORIZED", "RATE_LIMITED", "TIMEOUT", "UNAVAILABLE", "CANCELLED", "BUDGET_EXCEEDED",
]);
const EnvelopeShape = {
  schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
  providerRunId: z.string().min(1),
  provider: ProviderIdSchema,
  providerVersion: z.string().min(1),
  startedAt: z.string().datetime({ offset: true }),
  finishedAt: z.string().datetime({ offset: true }),
  latencyMs: z.number().int().nonnegative(),
  usage: z.object({
    requestCount: z.number().int().nonnegative(),
    recordCount: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
  }).strict(),
  cost: z.object({
    configuredAmount: z.number().finite().nonnegative().nullable(),
    reservedAmount: z.number().finite().nonnegative().nullable(),
    actualAmount: z.number().finite().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
  provenance: z.array(z.object({
    schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
    providerId: ProviderIdSchema,
    providerSourceId: z.string().min(1),
    providerRunId: z.string().min(1),
    capturedAt: z.string().datetime({ offset: true }),
    sourceUrl: z.string().url().nullable(),
  }).strict()),
  limitations: z.array(z.string()),
};

const ProviderRunEnvelopeSchema = z.discriminatedUnion("status", [
  z.object({ ...EnvelopeShape, status: z.enum(["SUCCEEDED", "EMPTY"]), value: z.unknown(), failureKind: z.null(), capabilityError: z.null() }).strict(),
  z.object({ ...EnvelopeShape, status: z.literal("PARTIAL"), value: z.unknown(), failureKind: FailureKindSchema, capabilityError: CapabilityErrorSchema }).strict(),
  z.object({ ...EnvelopeShape, status: z.enum(["FAILED", "RATE_LIMITED", "TIMEOUT"]), value: z.null(), failureKind: FailureKindSchema.exclude(["BUDGET_EXCEEDED"]), capabilityError: CapabilityErrorSchema }).strict(),
]);
const RelatedRunsShape = { relatedRuns: z.array(ProviderRunEnvelopeSchema).optional() };

export const ProviderResultSchema = z.discriminatedUnion("status", [
  z.object({ ...EnvelopeShape, ...RelatedRunsShape, status: z.enum(["SUCCEEDED", "EMPTY"]), value: z.unknown(), failureKind: z.null(), capabilityError: z.null() }).strict(),
  z.object({ ...EnvelopeShape, ...RelatedRunsShape, status: z.literal("PARTIAL"), value: z.unknown(), failureKind: FailureKindSchema, capabilityError: CapabilityErrorSchema }).strict(),
  z.object({ ...EnvelopeShape, ...RelatedRunsShape, status: z.enum(["FAILED", "RATE_LIMITED", "TIMEOUT"]), value: z.null(), failureKind: FailureKindSchema.exclude(["BUDGET_EXCEEDED"]), capabilityError: CapabilityErrorSchema }).strict(),
]);
