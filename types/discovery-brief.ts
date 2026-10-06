import type { z } from "zod";
import type { DiscoveryBriefSchema, DiscoveryBriefSummarySchema } from "../lib/domain/schemas/market-profile";

export type DiscoveryBrief = z.infer<typeof DiscoveryBriefSchema>;
export type DiscoveryBriefSummary = z.infer<typeof DiscoveryBriefSummarySchema>;
