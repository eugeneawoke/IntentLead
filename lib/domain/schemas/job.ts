import { z } from "zod";
import {
  CapabilitySchema, DiscoveryCapabilitySchema, IdSchema, MarketProfileIdSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

const errorShape = {
  schemaVersion: z.literal(1), message: NonEmptyStringSchema,
  capability: CapabilitySchema, traceId: IdSchema,
};
export const RetryableCapabilityErrorSchema = z.object({
  ...errorShape, retryable: z.literal(true),
  code: z.enum(["RATE_LIMITED", "TIMEOUT", "DEPENDENCY_UNAVAILABLE"]),
  retryAfterMs: z.number().int().nonnegative().nullable(),
}).strict();
export const CapabilityErrorSchema = z.discriminatedUnion("retryable", [
  RetryableCapabilityErrorSchema,
  z.object({
    ...errorShape, retryable: z.literal(false), retryAfterMs: z.null(),
    code: z.enum([
      "INVALID_INPUT", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "POLICY_DENIED",
      "CAPABILITY_UNAVAILABLE", "BUDGET_EXCEEDED", "CONFLICT", "INTERNAL_ERROR",
    ]),
  }).strict(),
]);

const jobShape = {
  ...ScopedRecordShape, capability: CapabilitySchema, marketProfileId: MarketProfileIdSchema,
  discoveryBriefId: IdSchema.nullable(), idempotencyKey: IdSchema, traceId: IdSchema,
  attempt: z.number().int().nonnegative(), maxAttempts: z.number().int().positive(),
  createdAt: TimestampSchema, updatedAt: TimestampSchema,
};
const LeaseSchema = z.object({ owner: IdSchema, token: IdSchema, expiresAt: TimestampSchema }).strict();

// State-specific fields prevent terminal jobs retaining a lease or retrying permanent errors.
export const JobSchema = z.discriminatedUnion("state", [
  z.object({ ...jobShape, state: z.literal("QUEUED") }).strict(),
  z.object({ ...jobShape, state: z.literal("LEASED"), lease: LeaseSchema }).strict(),
  z.object({ ...jobShape, state: z.literal("RUNNING"), lease: LeaseSchema, startedAt: TimestampSchema, heartbeatAt: TimestampSchema }).strict(),
  z.object({ ...jobShape, state: z.literal("RETRY_WAIT"), nextAttemptAt: TimestampSchema, error: RetryableCapabilityErrorSchema }).strict(),
  z.object({ ...jobShape, state: z.literal("COMPLETED"), completedAt: TimestampSchema, resultIds: z.array(IdSchema) }).strict(),
  z.object({ ...jobShape, state: z.literal("PARTIAL"), completedAt: TimestampSchema, resultIds: z.array(IdSchema).nonempty(), errors: z.array(CapabilityErrorSchema).nonempty() }).strict(),
  z.object({ ...jobShape, state: z.literal("FAILED"), completedAt: TimestampSchema, error: CapabilityErrorSchema }).strict(),
  z.object({ ...jobShape, state: z.literal("CANCELLED"), cancelledAt: TimestampSchema, reason: NonEmptyStringSchema }).strict(),
]).refine(job => job.attempt <= job.maxAttempts, "Attempt exceeds retry budget")
  .refine(job => job.state !== "RETRY_WAIT" || job.attempt < job.maxAttempts, "Retry budget exhausted")
  .refine(job => job.marketProfileId !== "EN_DISCOVERY_ONLY" || DiscoveryCapabilitySchema.safeParse(job.capability).success, "Capability disabled for discovery-only jobs")
  .refine(job => Date.parse(job.updatedAt) >= Date.parse(job.createdAt), "updatedAt precedes createdAt");
