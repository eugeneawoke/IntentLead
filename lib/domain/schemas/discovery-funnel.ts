import { z } from "zod";

export const DiscoveryFunnelMetricsSchema = z.object({
  rawCandidates: z.number().int().nonnegative(),
  normalizedCandidates: z.number().int().nonnegative(),
  deduplicatedSignals: z.number().int().nonnegative(),
  processedSignals: z.number().int().nonnegative(),
  confirmedSignals: z.number().int().nonnegative(),
  uniqueCompanies: z.number().int().nonnegative(),
  opportunitiesReturned: z.number().int().nonnegative(),
  acceptedOpportunities: z.number().int().nonnegative().nullable(),
}).strict().superRefine((value, ctx) => {
  const ordered = [
    value.rawCandidates, value.normalizedCandidates, value.deduplicatedSignals, value.processedSignals, value.confirmedSignals,
  ];
  if (ordered.some((count, index) => index > 0 && count > ordered[index - 1]!)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Discovery signal counts must not increase down the funnel" });
  }
  if (value.uniqueCompanies > value.confirmedSignals) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["uniqueCompanies"], message: "Unique companies cannot exceed confirmed signals" });
  }
  if (value.acceptedOpportunities !== null && value.acceptedOpportunities > value.opportunitiesReturned) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["acceptedOpportunities"], message: "Accepted Opportunities cannot exceed returned Opportunities" });
  }
});
