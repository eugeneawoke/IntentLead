import { z } from "zod";
import {
  IdSchema,
  NonEmptyStringSchema,
  ScopedRecordShape,
  SignalFamilySchema,
  TimestampSchema,
} from "./common";

export const BusinessTypeSchema = z.enum(["SAAS", "AGENCY", "CONSULTING", "LOCAL_SERVICE", "OTHER"]);
export const SourceMarketProfileIdSchema = z.enum([
  "EN_DISCOVERY_ONLY", "GLOBAL_EN", "CIS", "CIS_RU", "RU", "BY", "KZ", "LOCAL_CUSTOM",
]);
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
  marketProfileIds: z.array(SourceMarketProfileIdSchema).nonempty(),
  languages: z.array(NonEmptyStringSchema).nonempty(),
  businessTypes: z.array(z.union([BusinessTypeSchema, z.literal("ALL")])).nonempty(),
  signalFamilies: z.array(SignalFamilySchema).nonempty(),
  priority: z.number().int().nonnegative(),
  expectedValueScore: z.number().min(0).max(1).default(0.5),
  rationale: NonEmptyStringSchema,
}).strict();

export const SourcePlanRequestSchema = z.object({
  ...ScopedRecordShape,
  discoveryBriefId: IdSchema,
  marketProfileId: SourceMarketProfileIdSchema,
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
  expectedValueScore: true,
  rationale: true,
});

export const SourceGapReasonSchema = z.enum([
  "PROHIBITED", "LEGAL_RESTRICTED", "LEGAL_UNASSESSED", "MISSING_CREDENTIALS", "PAID_LOCKED", "DISABLED", "RATE_LIMITED",
  "ERROR", "MANUAL_ONLY", "UNAVAILABLE", "PLANNED", "BUDGET_EXCEEDED",
]);

function requiredGapReason(source: z.infer<typeof SelectedSourceSchema>): z.infer<typeof SourceGapReasonSchema> | null {
  if (source.legalStatus === "PROHIBITED") return "PROHIBITED";
  if (source.legalStatus === "RESTRICTED") return "LEGAL_RESTRICTED";
  if (source.legalStatus === "UNASSESSED") return "LEGAL_UNASSESSED";
  if (source.state !== "READY" && source.state !== "DEGRADED") return source.state;
  if (source.configuredCost.amount === null || source.configuredCost.currency === null) return "BUDGET_EXCEEDED";
  return null;
}

export const SourcePlanSchema = z.object({
  ...ScopedRecordShape,
  discoveryBriefId: IdSchema,
  marketProfileId: SourceMarketProfileIdSchema,
  requestedConfirmedSignals: z.number().int().min(20).max(500),
  status: z.enum(["READY", "PARTIAL", "BLOCKED"]),
  selected: z.array(SelectedSourceSchema),
  executable: z.array(SelectedSourceSchema),
  gaps: z.array(z.object({ providerKey: NonEmptyStringSchema, reason: SourceGapReasonSchema }).strict()),
  createdAt: TimestampSchema,
}).strict().superRefine((plan, ctx) => {
  const selectedKeys = new Set<string>();
  const selectedByKey = new Map<string, z.infer<typeof SelectedSourceSchema>>();
  for (const [index, source] of plan.selected.entries()) {
    if (selectedKeys.has(source.providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selected", index, "providerKey"], message: "SourcePlan provider keys must be unique" });
    }
    selectedKeys.add(source.providerKey);
    selectedByKey.set(source.providerKey, source);
  }
  const executableKeys = new Set<string>();
  for (const [index, source] of plan.executable.entries()) {
    if (!selectedKeys.has(source.providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executable", index, "providerKey"], message: "Executable sources must be selected" });
    } else if (JSON.stringify(selectedByKey.get(source.providerKey)) !== JSON.stringify(source)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executable", index], message: "Executable source must match its selected snapshot" });
    }
    if (executableKeys.has(source.providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executable", index, "providerKey"], message: "Executable provider keys must be unique" });
    }
    if (source.legalStatus !== "ALLOWED" || !["READY", "DEGRADED"].includes(source.state)
      || source.configuredCost.amount === null || source.configuredCost.currency === null) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["executable", index], message: "Executable sources must be allowed and operational" });
    }
    executableKeys.add(source.providerKey);
  }
  const gapKeys = new Set<string>();
  for (const [index, gap] of plan.gaps.entries()) {
    if (!selectedKeys.has(gap.providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gaps", index, "providerKey"], message: "Source gaps must refer to selected sources" });
    }
    if (gapKeys.has(gap.providerKey) || executableKeys.has(gap.providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gaps", index, "providerKey"], message: "A selected source must have exactly one execution outcome" });
    }
    const selected = selectedByKey.get(gap.providerKey);
    const expectedReason = selected ? requiredGapReason(selected) : null;
    if (selected && gap.reason !== (expectedReason ?? "BUDGET_EXCEEDED")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["gaps", index, "reason"], message: "Source gap reason does not match its selected snapshot" });
    }
    gapKeys.add(gap.providerKey);
  }
  for (const providerKey of selectedKeys) {
    if (!executableKeys.has(providerKey) && !gapKeys.has(providerKey)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["selected"], message: `Selected source ${providerKey} has no execution outcome` });
    }
  }
  const executableFamilies = new Set(plan.executable.map(source => source.sourceFamily)).size;
  const expectedStatus = plan.executable.length === 0 ? "BLOCKED" : executableFamilies >= 3 ? "READY" : "PARTIAL";
  if (plan.status !== expectedStatus) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["status"], message: "SourcePlan status does not match its executable portfolio" });
  }
});
