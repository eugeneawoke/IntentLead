import { z } from "zod";
import {
  EvidenceIdsSchema,
  IdSchema,
  NonEmptyStringSchema,
} from "./common";

export const ModelCapabilitySchema = z.enum([
  "STRUCTURE_DISCOVERY_BRIEF",
  "PROPOSE_SOURCE_PLAN",
  "INTERPRET_EVIDENCE",
  "ASSESS_OPPORTUNITY",
  "RANK_BUYERS",
  "DRAFT_GROUNDED_COPY",
]);

export const ModelProviderIdSchema = z.enum(["openai", "anthropic", "gemini", "local"]);
export const ModelProviderStateSchema = z.enum([
  "configured", "fixture_only", "missing_credentials", "paid_locked", "planned", "disabled", "unavailable",
  "rate_limited", "degraded", "error",
]);

export const ModelProviderDescriptorSchema = z.object({
  id: ModelProviderIdSchema,
  model: NonEmptyStringSchema,
  version: NonEmptyStringSchema,
  capabilities: z.array(ModelCapabilitySchema).nonempty(),
  operationalState: ModelProviderStateSchema,
  maxInputTokens: z.number().int().positive(),
  configuredCostPerMillionInputTokens: z.number().finite().nonnegative().nullable(),
  configuredCostPerMillionOutputTokens: z.number().finite().nonnegative().nullable(),
  configuredCostCurrency: z.string().regex(/^[A-Z]{3}$/).nullable(),
}).strict();

export const StructuredDiscoveryIntakeSchema = z.object({
  offerSummary: z.string().trim().min(1).max(500).nullable(),
  desiredOutcomes: z.array(z.string().trim().min(1).max(500)).max(20),
  targetCompanyDescription: z.string().trim().min(1).max(500).nullable(),
  targetBuyerDescription: z.string().trim().min(1).max(500).nullable(),
  markets: z.array(z.string().trim().min(1).max(120)).max(10),
  languages: z.array(z.string().trim().min(1).max(80)).max(10),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(30),
  requestedConfirmedSignals: z.number().int().min(20).max(500).nullable(),
  missingRequiredFields: z.array(z.enum(["offer", "target_company", "market"])).max(3),
  assumptionsForReview: z.array(z.string().trim().min(1).max(500)).max(10),
  ambiguitiesForClarification: z.array(z.object({
    field: z.enum(["offer", "target_company", "target_buyer", "market", "language", "exclusions", "target_count"]),
    description: z.string().trim().min(1).max(500),
  }).strict()).max(10).default([]),
}).strict().superRefine((intake, ctx) => {
  const required = new Set(intake.missingRequiredFields);
  if (required.size !== intake.missingRequiredFields.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Missing fields must be unique" });
  }
  if (intake.offerSummary === null && !required.has("offer")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Missing offer must be explicit" });
  }
  if (intake.targetCompanyDescription === null && !required.has("target_company")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Missing target company must be explicit" });
  }
  if (intake.markets.length === 0 && !required.has("market")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Missing market must be explicit" });
  }
  if (intake.offerSummary !== null && required.has("offer")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Resolved offer cannot remain missing" });
  }
  if (intake.targetCompanyDescription !== null && required.has("target_company")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Resolved target company cannot remain missing" });
  }
  if (intake.markets.length > 0 && required.has("market")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["missingRequiredFields"], message: "Resolved market cannot remain missing" });
  }
});

export const ModelBudgetSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/),
  remainingCost: z.number().finite().nonnegative(),
  remainingInputTokens: z.number().int().nonnegative(),
  remainingOutputTokens: z.number().int().nonnegative(),
  remainingCalls: z.number().int().nonnegative(),
}).strict();

export const ModelInvocationPolicySchema = z.object({
  capability: ModelCapabilitySchema,
  evidenceIds: z.array(IdSchema),
  budget: ModelBudgetSchema,
  allowExternalActions: z.literal(false),
  allowProviderSelection: z.literal(false),
  sourceContentRole: z.literal("UNTRUSTED_DATA"),
}).strict().superRefine((policy, ctx) => {
  const evidenceRequired = policy.capability !== "STRUCTURE_DISCOVERY_BRIEF" && policy.capability !== "PROPOSE_SOURCE_PLAN";
  if (evidenceRequired && policy.evidenceIds.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["evidenceIds"], message: "Reasoning capability requires evidence" });
  }
});

export const GroundedModelClaimSchema = z.object({
  id: IdSchema,
  text: NonEmptyStringSchema,
  evidenceIds: EvidenceIdsSchema,
}).strict();
