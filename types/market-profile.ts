import type { z } from "zod";
import type { MarketProfileSchema } from "../lib/domain/schemas/market-profile";
import type { CapabilitySchema, JurisdictionSchema, MarketProfileIdSchema, WorkflowSchema } from "../lib/domain/schemas/common";

export type MarketProfile = z.infer<typeof MarketProfileSchema>;
export type MarketProfileId = z.infer<typeof MarketProfileIdSchema>;
export type Jurisdiction = z.infer<typeof JurisdictionSchema>;
export type Capability = z.infer<typeof CapabilitySchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
