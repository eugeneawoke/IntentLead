import { z } from "zod";
import {
  CapabilitySchema, ConfidenceSchema, IdSchema, JurisdictionSchema, MarketProfileIdSchema,
  NonEmptyStringSchema, ScopedRecordShape, TimestampSchema, WorkflowSchema,
} from "./common";

const packageCapabilities = ["PACKAGE_VERIFIED", "CONTACT_ENRICHMENT", "EMAIL_VERIFY", "DRAFT_GENERATION", "OUTREACH_READY"] as const;
export const VerificationPolicySchema = z.object({
  ...ScopedRecordShape,
  // A policy revision is independent of the wire schema version.
  version: z.number().int().positive(), marketProfileId: MarketProfileIdSchema,
  workflow: WorkflowSchema, jurisdictions: z.array(JurisdictionSchema), packageVerifiedAllowed: z.boolean(),
  checks: z.object({
    evidence: z.object({ minItems: z.number().int().positive(), minStrength: ConfidenceSchema, maxAgeDays: z.number().positive().finite() }).strict(),
    company: z.object({ minConfidence: ConfidenceSchema }).strict(),
    buyer: z.object({ minConfidence: ConfidenceSchema, minRelevance: ConfidenceSchema }).strict(),
    contact: z.object({ acceptedStatuses: z.array(z.literal("VALID")).nonempty(), maxAgeDays: z.number().positive().finite() }).strict(),
    groundedDraft: z.object({ requireEvidenceForEveryClaim: z.literal(true) }).strict(),
    suppression: z.object({ mustBeClear: z.literal(true) }).strict(),
    marketWorkflow: z.object({ requireEnabledCapabilities: z.array(CapabilitySchema).nonempty() }).strict(),
  }).strict(),
}).strict().superRefine((policy, ctx) => {
  if (policy.marketProfileId === "EN_DISCOVERY_ONLY" && policy.workflow !== "DISCOVERY_ONLY") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Discovery profile requires discovery-only workflow" });
  }
  if (policy.packageVerifiedAllowed && (policy.workflow === "DISCOVERY_ONLY" || policy.jurisdictions.length === 0)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Package verification requires an authorized jurisdiction-specific workflow" });
  }
  if (packageCapabilities.some(capability => !policy.checks.marketWorkflow.requireEnabledCapabilities.includes(capability))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Verification policy must retain every package capability gate" });
  }
});

const CheckResultSchema = z.object({
  status: z.enum(["PASS", "FAIL"]), reason: NonEmptyStringSchema, referenceIds: z.array(IdSchema),
}).strict();
const PassedCheckSchema = CheckResultSchema.extend({ status: z.literal("PASS"), referenceIds: z.array(IdSchema).nonempty() });
const resultShape = {
  ...ScopedRecordShape, policyId: IdSchema, policyVersion: z.number().int().positive(),
  packageId: IdSchema, opportunityId: IdSchema, marketProfileId: MarketProfileIdSchema,
  workflow: WorkflowSchema, evaluatedAt: TimestampSchema,
};
const checksShape = {
  evidence: CheckResultSchema, company: CheckResultSchema, buyer: CheckResultSchema,
  contact: CheckResultSchema, groundedDraft: CheckResultSchema, suppression: CheckResultSchema,
  marketWorkflow: CheckResultSchema,
};

// The server evaluates the stored policy and persists these results. Parsing a PASSED
// record never emits PACKAGE_VERIFIED or charges credits; the later atomic command does.
export const PackageVerificationResultSchema = z.discriminatedUnion("status", [
  z.object({
    ...resultShape, status: z.literal("PASSED"), marketProfileId: z.enum(["CIS_RU", "LOCAL_CUSTOM"]),
    workflow: z.literal("ASSISTED_OUTREACH"),
    checks: z.object({
      evidence: PassedCheckSchema, company: PassedCheckSchema, buyer: PassedCheckSchema,
      contact: PassedCheckSchema, groundedDraft: PassedCheckSchema, suppression: PassedCheckSchema,
      marketWorkflow: PassedCheckSchema,
    }).strict(),
  }).strict(),
  z.object({ ...resultShape, status: z.literal("FAILED"), checks: z.object(checksShape).strict() }).strict(),
]).refine(
  result => result.status !== "FAILED" || Object.values(result.checks).some(check => check.status === "FAIL"),
  "A failed package must record a failed check",
);
