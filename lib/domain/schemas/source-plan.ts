import { z } from "zod";
import {
  IdSchema,
  MarketProfileIdSchema,
  NonEmptyStringSchema,
  ScopedRecordShape,
  SignalFamilySchema,
  TimestampSchema,
} from "./common";

export const BusinessTypeSchema = z.enum(["SAAS", "AGENCY", "CONSULTING", "LOCAL_SERVICE", "OTHER"]);
export const SourceFamilySchema = z.enum([
  "PUBLIC_WEB", "COMMUNITY", "DEVELOPER", "JOBS", "REVIEWS", "NEWS", "MAPS", "DIRECTORIES", "OFFICIAL_SITE",
]);
export const SourceAccessModeSchema = z.enum([
  "OFFICIAL_API", "SEARCH_INDEX", "PUBLIC_WEB", "PARTNER_API", "MANUAL_ONLY", "UNAVAILABLE",
]);
export const SourceOperationalStateSchema = z.enum([
  "READY", "MISSING_CREDENTIALS", "PAID_LOCKED", "DISABLED", "RATE_LIMITED", "DEGRADED", "ERROR",
  "MANUAL_ONLY", "UNAVAILABLE", "PLANNED",
]);
export const SourceLegalStatusSchema = z.enum(["ALLOWED", "RESTRICTED", "PROHIBITED", "UNASSESSED"]);
export const SourceCostClassSchema = z.enum(["FREE", "FREE_TIER", "PAID", "UNKNOWN"]);

export const SourceCatalogEntrySchema = z.object({
  providerKey: NonEmptyStringSchema,
  sourceFamily: SourceFamilySchema,
  accessMode: SourceAccessModeSchema,
  state: SourceOperationalStateSchema,
  legalStatus: SourceLegalStatusSchema,
  costClass: SourceCostClassSchema,
  configuredCost: z.object({
    amount: z.number().finite().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  }).strict(),
  marketProfileIds: z.array(MarketProfileIdSchema).nonempty(),
  languages: z.array(NonEmptyStringSchema).nonempty(),
  businessTypes: z.array(z.union([BusinessTypeSchema, z.literal("ALL")])).nonempty(),
  signalFamilies: z.array(SignalFamilySchema).nonempty(),
  priority: z.number().int().nonnegative(),
  rationale: NonEmptyStringSchema,
}).strict();

export const SourcePlanRequestSchema = z.object({
  ...ScopedRecordShape,
  discoveryBriefId: IdSchema,
  marketProfileId: MarketProfileIdSchema,
  languages: z.array(NonEmptyStringSchema).nonempty(),
  businessType: BusinessTypeSchema,
  signalFamilies: z.array(SignalFamilySchema).nonempty(),
  requestedConfirmedSignals: z.number().int().min(20).max(500),
  maxProviders: z.number().int().min(1).max(20),
  budget: z.object({ currency: z.string().regex(/^[A-Z]{3}$/), maxCost: z.number().finite().nonnegative() }).strict(),
  createdAt: TimestampSchema,
}).strict();

const SelectedSourceSchema = SourceCatalogEntrySchema.pick({
  providerKey: true,
  sourceFamily: true,
  accessMode: true,
  state: true,
  legalStatus: true,
  costClass: true,
  configuredCost: true,
  signalFamilies: true,
  priority: true,
  rationale: true,
});

export const SourceGapReasonSchema = z.enum([
  "PROHIBITED", "LEGAL_UNASSESSED", "MISSING_CREDENTIALS", "PAID_LOCKED", "DISABLED", "RATE_LIMITED",
  "ERROR", "MANUAL_ONLY", "UNAVAILABLE", "PLANNED", "BUDGET_EXCEEDED",
]);

export const SourcePlanSchema = z.object({
  ...ScopedRecordShape,
  discoveryBriefId: IdSchema,
  marketProfileId: MarketProfileIdSchema,
  requestedConfirmedSignals: z.number().int().min(20).max(500),
  status: z.enum(["READY", "PARTIAL", "BLOCKED"]),
  selected: z.array(SelectedSourceSchema),
  executable: z.array(SelectedSourceSchema),
  gaps: z.array(z.object({ providerKey: NonEmptyStringSchema, reason: SourceGapReasonSchema }).strict()),
  createdAt: TimestampSchema,
}).strict();
