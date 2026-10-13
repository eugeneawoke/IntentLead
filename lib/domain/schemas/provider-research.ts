import { z } from "zod";
import {
  ConfidenceSchema,
  HttpUrlSchema,
  IdSchema,
  NonEmptyStringSchema,
  TimestampSchema,
} from "./common";

export const PersonSearchInputSchema = z.object({
  companyId: IdSchema,
  companyName: NonEmptyStringSchema,
  companyDomain: NonEmptyStringSchema.nullable(),
  desiredRoles: z.array(NonEmptyStringSchema).nonempty().max(20),
  evidenceIds: z.array(IdSchema).nonempty(),
  maxResults: z.number().int().min(1).max(25),
}).strict();

export const PersonDiscoveryCandidateSchema = z.object({
  providerPersonId: NonEmptyStringSchema,
  fullName: NonEmptyStringSchema,
  role: NonEmptyStringSchema.nullable(),
  companyName: NonEmptyStringSchema,
  companyDomain: NonEmptyStringSchema.nullable(),
  profileUrl: HttpUrlSchema.nullable(),
  sourceUrl: HttpUrlSchema,
  capturedAt: TimestampSchema,
  confidence: ConfidenceSchema,
}).strict();

const EmailFindBaseShape = {
  companyId: IdSchema,
  companyDomain: NonEmptyStringSchema,
  evidenceIds: z.array(IdSchema).nonempty(),
};

export const EmailFindInputSchema = z.discriminatedUnion("scope", [
  z.object({
    ...EmailFindBaseShape,
    scope: z.literal("PERSON"),
    personId: IdSchema,
    fullName: NonEmptyStringSchema,
    providerPersonId: NonEmptyStringSchema.nullable(),
  }).strict(),
  z.object({
    ...EmailFindBaseShape,
    scope: z.literal("COMPANY"),
    personId: z.null(),
    fullName: z.null(),
    providerPersonId: z.null(),
  }).strict(),
]);

const ContactDiscoverySourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PUBLIC_WEB"), url: HttpUrlSchema, providerRunId: z.null() }).strict(),
  z.object({ kind: z.literal("AUTHORIZED_PROVIDER"), url: HttpUrlSchema.nullable(), providerRunId: IdSchema }).strict(),
]);

export const ContactDiscoveryCandidateSchema = z.object({
  state: z.enum(["FOUND", "UNKNOWN"]),
  channel: z.literal("email"),
  value: z.string().email().nullable(),
  scope: z.enum(["PERSON", "COMPANY"]),
  source: ContactDiscoverySourceSchema.nullable(),
  capturedAt: TimestampSchema,
  confidence: ConfidenceSchema,
}).strict().superRefine((candidate, ctx) => {
  if (candidate.state === "FOUND" && (candidate.value === null || candidate.source === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Found contact requires value and source provenance" });
  }
  if (candidate.state === "UNKNOWN" && (candidate.value !== null || candidate.source !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Unknown contact cannot carry a value or source" });
  }
});

export const EmailVerifyInputSchema = z.object({
  contactPointId: IdSchema,
  email: z.string().email(),
  sourceUrl: HttpUrlSchema,
}).strict();

export const ContactVerificationObservationSchema = z.object({
  status: z.enum(["VALID", "INVALID", "RISKY", "UNKNOWN"]),
  method: z.literal("PROVIDER"),
  checkedAt: TimestampSchema,
  expiresAt: TimestampSchema.nullable(),
  confidence: ConfidenceSchema,
  providerReason: NonEmptyStringSchema.nullable(),
}).strict().superRefine((observation, ctx) => {
  if (observation.status === "VALID" && observation.expiresAt === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Valid verification requires expiry" });
  }
  if (observation.expiresAt !== null && Date.parse(observation.expiresAt) < Date.parse(observation.checkedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Expiry precedes verification" });
  }
});
