import type { z } from "zod";
import type { DiscoveryBriefSchema } from "../lib/domain/schemas/market-profile";

export type DiscoveryBrief = z.infer<typeof DiscoveryBriefSchema>;
