import { z } from "zod";
import {
  CapabilitySchema, ChannelSchema, DiscoveryCapabilitySchema, IdSchema, JurisdictionSchema,
  MarketProfileIdSchema, NonEmptyStringSchema, RestrictedCapabilitySchema, ScopedRecordShape,
  SignalFamilySchema, TimestampSchema, WorkflowSchema,
} from "./common";

const LanguageSchema = z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
const profileShape = {
  ...ScopedRecordShape, jurisdictions: z.array(JurisdictionSchema), regions: z.array(NonEmptyStringSchema),
  languages: z.array(LanguageSchema).nonempty(), capabilities: z.array(CapabilitySchema),
  disabledCapabilities: z.array(CapabilitySchema), legalPolicyId: IdSchema, retentionPolicyId: IdSchema,
  outreachPolicyId: IdSchema.nullable(), outreachChannels: z.array(ChannelSchema),
  defaultCurrency: z.string().regex(/^[A-Z]{3}$/), timezone: NonEmptyStringSchema,
};

export const MarketProfileSchema = z.discriminatedUnion("id", [
  z.object({
    ...profileShape, id: z.literal("EN_DISCOVERY_ONLY"), workflow: z.literal("DISCOVERY_ONLY"),
    capabilities: z.array(DiscoveryCapabilitySchema), outreachChannels: z.tuple([]), outreachPolicyId: z.null(),
  }).strict(),
  z.object({ ...profileShape, id: z.literal("CIS_RU"), workflow: WorkflowSchema, jurisdictions: z.array(JurisdictionSchema).nonempty() }).strict(),
  z.object({
    ...profileShape, id: z.literal("LOCAL_CUSTOM"), workflow: WorkflowSchema,
    jurisdictions: z.array(JurisdictionSchema).nonempty(), category: NonEmptyStringSchema, geography: NonEmptyStringSchema,
  }).strict(),
]).superRefine((profile, ctx) => {
  if (profile.capabilities.some(capability => profile.disabledCapabilities.includes(capability))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["capabilities"], message: "Enabled and disabled capabilities overlap" });
  }
  if (profile.workflow === "DISCOVERY_ONLY") {
    if (RestrictedCapabilitySchema.options.some(capability => !profile.disabledCapabilities.includes(capability)) ||
        profile.capabilities.some(capability => !DiscoveryCapabilitySchema.safeParse(capability).success) ||
        profile.outreachChannels.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Discovery-only profiles explicitly disable contact, outreach, outcomes and package verification" });
    }
  } else if (profile.jurisdictions.length === 0 || profile.outreachPolicyId === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Assisted outreach requires jurisdiction and outreach policy" });
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

export const DiscoveryBriefSummarySchema = z.object({
  id: z.string().uuid(),
  state: z.enum(["DRAFT", "QUEUED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  objective: z.string().min(1).max(500),
  criteria: DiscoveryCriteriaSchema,
  offer: z.object({
    id: z.string().uuid(), name: z.string().min(1),
    definition: z.object({
      summary: z.string().min(1).max(500),
      outcomes: z.array(z.string().min(1).max(500)).max(20),
      exclusions: z.array(z.string().min(1).max(500)).max(20),
    }).strict(),
  }).strict(),
  icp: z.object({
    id: z.string().uuid(), name: z.string().min(1),
    definition: z.object({
      description: z.string().min(1).max(500),
      companyAttributes: z.array(z.string().min(1).max(500)).max(30),
      exclusions: z.array(z.string().min(1).max(500)).max(20),
    }).strict(),
  }).strict(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict();
