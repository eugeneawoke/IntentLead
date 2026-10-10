import type { z } from "zod";
import type {
  ConversationalReviewApprovalEnvelopeSchema,
  ConversationalReviewReceiptSchema,
} from "../lib/domain/schemas/conversational-intake-api";

export type ConversationalReviewReceipt = z.infer<typeof ConversationalReviewReceiptSchema>;
export type ConversationalReviewApprovalEnvelope = z.infer<typeof ConversationalReviewApprovalEnvelopeSchema>;
