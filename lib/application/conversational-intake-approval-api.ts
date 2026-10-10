import { ConversationalReviewApprovalEnvelopeSchema } from "@/lib/domain/schemas/conversational-intake-api";
import type { CreatedDiscoveryBrief } from "@/types/discovery-brief";
import type { ApplicationSupabaseClient } from "./context";
import { ApplicationError } from "./errors";
import { createApprovedDiscoveryBrief } from "./conversational-intake-approval";
import { verifyConversationalReviewReceipt } from "./conversational-intake-review-receipt";

export async function approveConversationalIntake(
  serviceClient: ApplicationSupabaseClient,
  authenticatedUserId: string,
  rawEnvelope: unknown,
  receiptSecret: string,
  nowMs = Date.now(),
): Promise<CreatedDiscoveryBrief> {
  const envelope = ConversationalReviewApprovalEnvelopeSchema.safeParse(rawEnvelope);
  if (!envelope.success) throw new ApplicationError("INVALID_INPUT", "Invalid conversational review approval request");
  verifyConversationalReviewReceipt(
    envelope.data.reviewReceipt,
    envelope.data.approval.review,
    authenticatedUserId,
    receiptSecret,
    nowMs,
  );
  return createApprovedDiscoveryBrief(serviceClient, authenticatedUserId, envelope.data.approval);
}
