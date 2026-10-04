import { z } from "zod";
import {
  ConfidenceSchema, EvidenceIdsSchema, HttpUrlSchema, IdSchema, JurisdictionSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema,
} from "./common";

export const PersonSchema = z.object({
  ...ScopedRecordShape, fullName: NonEmptyStringSchema, companyId: IdSchema.nullable(),
  role: NonEmptyStringSchema.nullable(), jurisdiction: JurisdictionSchema.nullable(),
  evidenceIds: EvidenceIdsSchema, confidence: ConfidenceSchema, resolvedAt: TimestampSchema,
}).strict();
export const BuyerCandidateSchema = z.object({
  ...ScopedRecordShape, opportunityId: IdSchema, companyId: IdSchema, personId: IdSchema.nullable(),
  role: NonEmptyStringSchema, hypothesis: NonEmptyStringSchema, evidenceIds: EvidenceIdsSchema,
  confidence: ConfidenceSchema, relevance: ConfidenceSchema, createdAt: TimestampSchema,
}).strict();

const contactShape = {
  ...ScopedRecordShape, personId: IdSchema.nullable(), companyId: IdSchema.nullable(),
  jurisdiction: JurisdictionSchema, evidenceIds: EvidenceIdsSchema,
  capturedAt: TimestampSchema, latestVerificationId: IdSchema.nullable(),
};
export const ContactPointSchema = z.discriminatedUnion("channel", [
  z.object({ ...contactShape, channel: z.literal("email"), value: z.string().email() }).strict(),
  z.object({ ...contactShape, channel: z.literal("profile"), value: HttpUrlSchema }).strict(),
  z.object({ ...contactShape, channel: z.literal("phone"), value: z.string().regex(/^\+[1-9]\d{6,14}$/) }).strict(),
]).refine(contact => contact.personId !== null || contact.companyId !== null, "Contact requires a person or company");

export const ContactVerificationStatusSchema = z.enum(["VALID", "INVALID", "RISKY", "UNKNOWN"]);
export const ContactVerificationSchema = z.object({
  ...ScopedRecordShape, contactPointId: IdSchema, status: ContactVerificationStatusSchema,
  checkedAt: TimestampSchema, expiresAt: TimestampSchema.nullable(),
  verificationMethod: NonEmptyStringSchema, confidence: ConfidenceSchema, evidenceIds: EvidenceIdsSchema,
}).strict().refine(
  item => item.expiresAt === null || Date.parse(item.expiresAt) >= Date.parse(item.checkedAt),
  "Verification expiry precedes its observation",
);
