import type { z } from "zod";
import type {
  ConversationalIntakeReviewSchema,
  ConversationalUserTurnSchema,
  IntakeFieldSupportSchema,
  StructureConversationalIntakeInputSchema,
  StructureDiscoveryIntakePortResultSchema,
} from "../lib/domain/schemas/conversational-intake";

export type ConversationalUserTurn = z.infer<typeof ConversationalUserTurnSchema>;
export type StructureConversationalIntakeInput = z.infer<typeof StructureConversationalIntakeInputSchema>;
export type IntakeFieldSupport = z.infer<typeof IntakeFieldSupportSchema>;
export type StructureDiscoveryIntakePortResult = z.infer<typeof StructureDiscoveryIntakePortResultSchema>;
export type ConversationalIntakeReview = z.infer<typeof ConversationalIntakeReviewSchema>;

export interface StructureDiscoveryIntakePort {
  structure(input: StructureConversationalIntakeInput): Promise<StructureDiscoveryIntakePortResult>;
}
