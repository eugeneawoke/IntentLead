import { z } from "zod";
import {
  CapabilitySchema, IdSchema, JurisdictionSchema, MarketProfileIdSchema, NonEmptyStringSchema,
  ScopedRecordShape, SignalFamilySchema, TimestampSchema,
} from "./common";
import { IntakePromptMetadataSchema, ModelRunTelemetrySchema } from "./conversational-intake";

export const LanguageSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const profileShape = {
  ...ScopedRecordShape, jurisdictions: z.array(JurisdictionSchema), regions: z.array(NonEmptyStringSchema),
  languages: z.array(LanguageSchema).nonempty(), capabilities: z.array(CapabilitySchema),
  disabledCapabilities: z.array(CapabilitySchema), legalPolicyId: IdSchema, retentionPolicyId: IdSchema,
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/), timezone: NonEmptyStringSchema,
  workflow: z.literal("DISCOVERY_ONLY"),
};

export const MarketProfileSchema = z.discriminatedUnion("id", [
  z.object({
    ...profileShape, id: z.literal("EN_DISCOVERY_ONLY"),
  }).strict(),
  z.object({ ...profileShape, id: z.literal("CIS_RU"), jurisdictions: z.array(JurisdictionSchema).nonempty() }).strict(),
  z.object({
    ...profileShape, id: z.literal("LOCAL_CUSTOM"),
    jurisdictions: z.array(JurisdictionSchema).nonempty(), category: NonEmptyStringSchema, geography: NonEmptyStringSchema,
  }).strict(),
]).superRefine((profile, ctx) => {
  const transmissionCapabilities = [
    "MAILBOX_CONNECT", "MESSAGE_SEND", "SEQUENCE_RUN", "FOLLOW_UP", "DELIVERY_TRACKING",
  ] as const;
  if (profile.capabilities.some(capability => profile.disabledCapabilities.includes(capability))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["capabilities"], message: "Enabled and disabled capabilities overlap" });
  }
  for (const capability of transmissionCapabilities) {
    if (profile.capabilities.includes(capability)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capabilities"],
        message: `${capability} is unavailable in IntentLead`,
      });
    }
    if (!profile.disabledCapabilities.includes(capability)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["disabledCapabilities"],
        message: `${capability} must be explicitly disabled`,
      });
    }
  }
});

export const DiscoveryBriefSchema = z.object({
  ...ScopedRecordShape, offerProfileId: IdSchema, icpDefinitionId: IdSchema,
  marketProfileId: MarketProfileIdSchema, objective: NonEmptyStringSchema,
  jurisdictions: z.array(JurisdictionSchema), languages: z.array(LanguageSchema).nonempty(),
  signalFamilies: z.array(SignalFamilySchema).nonempty(), exclusions: z.array(NonEmptyStringSchema),
  limits: z.object({ maxSourceItems: z.number().int().positive(), maxOpportunities: z.number().int().positive() }).strict(),
  createdAt: TimestampSchema,
}).strict().refine(
  brief => brief.marketProfileId === "EN_DISCOVERY_ONLY" || brief.jurisdictions.length > 0,
  "Regional discovery requires explicit jurisdiction",
);

export const DiscoveryCriteriaSchema = z.object({
  jurisdictions: z.array(JurisdictionSchema).max(30).default([]),
  languages: z.array(LanguageSchema).min(1).max(10).default(["en"]),
  signalFamilies: z.array(z.enum([
    "EXPRESSED_INTENT", "BUSINESS_EVENT", "DETECTED_PROBLEM", "MARKET_OBSERVATION",
  ])).min(1).max(4),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
  limits: z.object({
    maxSourceItems: z.number().int().min(1).max(500),
    maxOpportunities: z.number().int().min(1).max(100),
  }).strict(),
}).strict();

const MarketIntentSchema = z.string().trim().min(1).max(120);
export const IntakeMarketMappingSchema = z.discriminatedUnion("scope", [
  z.object({
    marketIntent: MarketIntentSchema,
    scope: z.literal("GLOBAL"),
    jurisdictions: z.array(JurisdictionSchema).length(0),
  }).strict(),
  z.object({
    marketIntent: MarketIntentSchema,
    scope: z.literal("JURISDICTIONS"),
    jurisdictions: z.array(JurisdictionSchema).min(1).max(30),
  }).strict(),
]);

export const IntakeLanguageMappingSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("USER_STATED"),
    languageIntent: z.string().trim().min(1).max(80),
    language: LanguageSchema,
  }).strict(),
  z.object({
    source: z.literal("HUMAN_ADDED"),
    languageIntent: z.null(),
    language: LanguageSchema,
    rationale: z.string().trim().min(1).max(500),
  }).strict(),
]);

export const IntakeExclusionMappingSchema = z.object({
  exclusion: z.string().trim().min(1).max(500),
  destination: z.enum(["OFFER", "ICP", "DISCOVERY"]),
}).strict();

export const IntakeApprovalMetadataSchema = z.object({
  reviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  requestFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  humanApproved: z.literal(true),
  prompt: IntakePromptMetadataSchema,
  telemetry: ModelRunTelemetrySchema,
  marketMappings: z.array(IntakeMarketMappingSchema).min(1).max(10),
  languageMappings: z.array(IntakeLanguageMappingSchema).max(10),
  exclusionMappings: z.array(IntakeExclusionMappingSchema).max(30),
}).strict();

export const DiscoveryCriteriaV2Schema = z.object({
  schemaVersion: z.literal(2),
  jurisdictions: z.array(JurisdictionSchema).max(30),
  marketIntent: z.array(MarketIntentSchema).min(1).max(10)
    .refine(values => new Set(values).size === values.length, "Market intent values must be unique"),
  languages: z.array(LanguageSchema).min(1).max(10),
  signalFamilies: z.array(SignalFamilySchema).min(1).max(4),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(30),
  requestedConfirmedSignals: z.number().int().min(20).max(500),
  limits: z.object({
    maxSourceItems: z.number().int().min(1).max(500),
    maxOpportunities: z.number().int().min(1).max(100),
  }).strict(),
  intakeApproval: IntakeApprovalMetadataSchema,
}).strict();

export const DiscoveryBriefCriteriaSchema = z.union([DiscoveryCriteriaV2Schema, DiscoveryCriteriaSchema]);

export const OfferProfileDefinitionSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  outcomes: z.array(z.string().trim().min(1).max(500)).max(20),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(20),
}).strict();

export const ICPDefinitionSchema = z.object({
  description: z.string().trim().min(1).max(500),
  targetBuyerDescription: z.string().trim().min(1).max(500).nullable().optional(),
  companyAttributes: z.array(z.string().trim().min(1).max(500)).max(30),
  exclusions: z.array(z.string().trim().min(1).max(500)).max(20),
}).strict();

export const OfferProfileContextSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1),
  definition: OfferProfileDefinitionSchema,
}).strict();

export const ICPDefinitionContextSchema = z.object({
  id: IdSchema,
  name: z.string().trim().min(1),
  definition: ICPDefinitionSchema,
}).strict();

export const DiscoveryBriefSummarySchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["DRAFT", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  objective: z.string().min(1).max(500),
  criteria: DiscoveryBriefCriteriaSchema,
  offer: OfferProfileContextSchema.extend({ id: z.string().uuid() }),
  icp: ICPDefinitionContextSchema.extend({ id: z.string().uuid() }),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();
