import { z } from "zod";
import {
  ConfidenceSchema,
  ContentHashSchema,
  EvidenceIdsSchema,
  HttpUrlSchema,
  IdSchema,
  JurisdictionSchema,
  NonEmptyStringSchema,
  ScopedRecordShape,
  TimestampSchema,
} from "./common";

export const PersonSchema = z.object({
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  companyId: IdSchema,
  fullName: NonEmptyStringSchema,
  role: NonEmptyStringSchema.nullable(),
  jurisdiction: JurisdictionSchema.nullable(),
  evidenceIds: EvidenceIdsSchema,
  confidence: ConfidenceSchema,
  resolvedAt: TimestampSchema,
}).strict();

export const BuyerCandidateSchema = z.object({
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  companyId: IdSchema,
  personId: IdSchema.nullable(),
  role: NonEmptyStringSchema,
  hypothesis: NonEmptyStringSchema,
  evidenceIds: EvidenceIdsSchema,
  confidence: ConfidenceSchema,
  relevance: ConfidenceSchema,
  rank: z.number().int().positive(),
  createdAt: TimestampSchema,
}).strict();

const ContactSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("PUBLIC_WEB"), url: HttpUrlSchema, providerRunId: z.null() }).strict(),
  z.object({ kind: z.literal("AUTHORIZED_PROVIDER"), url: HttpUrlSchema.nullable(), providerRunId: IdSchema }).strict(),
  z.object({ kind: z.literal("USER_PROVIDED"), url: HttpUrlSchema.nullable(), providerRunId: z.null() }).strict(),
]);

const contactShape = {
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  personId: IdSchema.nullable(),
  companyId: IdSchema,
  state: z.enum(["AVAILABLE", "SUPPRESSED", "DELETED"]),
  scope: z.enum(["PERSON", "COMPANY"]),
  valueHash: ContentHashSchema,
  source: ContactSourceSchema,
  jurisdiction: JurisdictionSchema,
  evidenceIds: EvidenceIdsSchema,
  capturedAt: TimestampSchema,
  marketPolicyId: IdSchema,
  resolutionConfidence: ConfidenceSchema,
  suppressionEntryId: IdSchema.nullable(),
};

export const ContactPointSchema = z.discriminatedUnion("channel", [
  z.object({ ...contactShape, channel: z.literal("email"), value: z.string().email().nullable() }).strict(),
  z.object({ ...contactShape, channel: z.literal("profile"), value: HttpUrlSchema.nullable() }).strict(),
  z.object({ ...contactShape, channel: z.literal("phone"), value: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable() }).strict(),
]).superRefine((contact, ctx) => {
  if (contact.state === "AVAILABLE" && contact.value === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Available contact requires a value" });
  }
  if (contact.state === "AVAILABLE" && contact.suppressionEntryId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["suppressionEntryId"], message: "Available contact cannot reference suppression" });
  }
  if (contact.state === "SUPPRESSED" && (contact.value !== null || contact.suppressionEntryId === null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Suppressed contact must redact its value and reference suppression" });
  }
  if (contact.state === "DELETED" && (contact.value !== null || contact.suppressionEntryId !== null)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["state"], message: "Deleted contact must redact its value without claiming suppression" });
  }
  if (contact.scope === "PERSON" && contact.personId === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "Person contact requires a resolved person" });
  }
  if (contact.scope === "COMPANY" && contact.personId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["personId"], message: "Company contact cannot claim a person" });
  }
});

export const ContactVerificationStatusSchema = z.enum(["VALID", "INVALID", "RISKY", "UNKNOWN"]);
export const ContactVerificationSchema = z.object({
  ...ScopedRecordShape,
  opportunityId: IdSchema,
  contactPointId: IdSchema,
  status: ContactVerificationStatusSchema,
  method: z.enum(["PUBLIC_SOURCE", "PROVIDER", "USER_CONFIRMED", "SYNTAX_ONLY"]),
  providerRunId: IdSchema.nullable(),
  checkedAt: TimestampSchema,
  expiresAt: TimestampSchema.nullable(),
  confidence: ConfidenceSchema,
  evidenceIds: EvidenceIdsSchema,
}).strict().superRefine((verification, ctx) => {
  if (verification.method === "PROVIDER" && verification.providerRunId === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["providerRunId"], message: "Provider verification requires a provider run" });
  }
  if (verification.method !== "PROVIDER" && verification.providerRunId !== null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["providerRunId"], message: "Only provider verification may reference a provider run" });
  }
  if (verification.method === "SYNTAX_ONLY" && verification.status === "VALID") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "Syntax-only checks cannot verify a contact" });
  }
  if (verification.status === "VALID" && verification.expiresAt === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Valid verification requires a finite policy expiry" });
  }
  if (Date.parse(verification.checkedAt) > Date.now()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["checkedAt"], message: "Verification cannot be observed in the future" });
  }
  if (verification.expiresAt !== null && Date.parse(verification.expiresAt) < Date.parse(verification.checkedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Verification expiry precedes its observation" });
  }
});
