import { z } from "zod";
import { PrepareApprovedDiscoveryBriefInputSchema } from "./discovery-brief-command";

export const ConversationalReviewReceiptSchema = z.object({
  schemaVersion: z.literal(1),
  userId: z.string().uuid(),
  reviewFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  issuedAtMs: z.number().int().nonnegative(),
  expiresAtMs: z.number().int().positive(),
  signature: z.string().regex(/^[a-f0-9]{64}$/),
}).strict().superRefine((receipt, ctx) => {
  if (receipt.expiresAtMs <= receipt.issuedAtMs || receipt.expiresAtMs - receipt.issuedAtMs > 30 * 60_000) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAtMs"], message: "Receipt lifetime is invalid" });
  }
});

export const ConversationalReviewApprovalEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  approval: PrepareApprovedDiscoveryBriefInputSchema,
  reviewReceipt: ConversationalReviewReceiptSchema,
}).strict();
