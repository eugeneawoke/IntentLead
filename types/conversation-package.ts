import type { z } from "zod";
import type {
  ConversationBriefSchema,
  DraftSchema,
  GroundedClaimSchema,
  GroundedDraftClaimSchema,
} from "../lib/domain/schemas/conversation-package";

export type GroundedClaim = z.infer<typeof GroundedClaimSchema>;
export type GroundedDraftClaim = z.infer<typeof GroundedDraftClaimSchema>;
export type ConversationBrief = z.infer<typeof ConversationBriefSchema>;
export type Draft = z.infer<typeof DraftSchema>;
