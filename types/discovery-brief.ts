import type { z } from "zod";
import type { DiscoveryBriefSchema, DiscoveryBriefSummarySchema } from "../lib/domain/schemas/market-profile";
import type {
  CreateDiscoveryBriefCommandSchema,
  CreateDiscoveryBriefInputSchema,
  CreateDiscoveryBriefV2InputSchema,
  PrepareApprovedDiscoveryBriefInputSchema,
} from "../lib/domain/schemas/discovery-brief-command";

export type DiscoveryBrief = z.infer<typeof DiscoveryBriefSchema>;
export type DiscoveryBriefSummary = z.infer<typeof DiscoveryBriefSummarySchema>;
export type CreateDiscoveryBriefInput = z.infer<typeof CreateDiscoveryBriefInputSchema>;
export type CreateDiscoveryBriefV2Input = z.infer<typeof CreateDiscoveryBriefV2InputSchema>;
export type CreateDiscoveryBriefCommand = z.infer<typeof CreateDiscoveryBriefCommandSchema>;
export type PrepareApprovedDiscoveryBriefInput = z.infer<typeof PrepareApprovedDiscoveryBriefInputSchema>;

export interface PreparedDiscoveryBrief {
  command: CreateDiscoveryBriefV2Input;
  idempotencyKey: string;
}

export interface CreatedDiscoveryBrief {
  discoveryBriefId: string;
  workspaceId: string;
  offerProfileId: string;
  icpDefinitionId: string;
  marketProfileId: string;
  created: boolean;
}
