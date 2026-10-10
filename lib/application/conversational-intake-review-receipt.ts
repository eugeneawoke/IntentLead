import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { ConversationalReviewReceiptSchema } from "@/lib/domain/schemas/conversational-intake-api";
import { ConversationalIntakeReviewSchema } from "@/lib/domain/schemas/conversational-intake";
import type { ConversationalReviewReceipt } from "@/types/conversational-intake-api";
import { ApplicationError } from "./errors";
import { fingerprintConversationalIntakeReview } from "./conversational-intake-approval";

const RECEIPT_TTL_MS = 15 * 60_000;
const UserIdSchema = z.string().uuid();

function requireSecret(secret: string): void {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new ApplicationError("CAPABILITY_UNAVAILABLE", "Conversational review approval is not configured");
  }
}

function unsigned(receipt: Omit<ConversationalReviewReceipt, "signature">): string {
  return [receipt.schemaVersion, receipt.userId, receipt.reviewFingerprint, receipt.issuedAtMs, receipt.expiresAtMs].join(".");
}

function sign(receipt: Omit<ConversationalReviewReceipt, "signature">, secret: string): string {
  return createHmac("sha256", secret).update(unsigned(receipt)).digest("hex");
}

function deny(): never {
  throw new ApplicationError("FORBIDDEN", "Conversational review receipt is invalid or expired");
}

export function issueConversationalReviewReceipt(
  rawReview: unknown,
  authenticatedUserId: string,
  secret: string,
  nowMs = Date.now(),
): ConversationalReviewReceipt {
  requireSecret(secret);
  const review = ConversationalIntakeReviewSchema.safeParse(rawReview);
  const userId = UserIdSchema.safeParse(authenticatedUserId);
  if (!review.success || !userId.success || !Number.isInteger(nowMs) || nowMs < 0) {
    throw new ApplicationError("INVALID_INPUT", "Cannot issue a receipt for an invalid conversational review");
  }
  const receipt = {
    schemaVersion: 1 as const,
    userId: userId.data,
    reviewFingerprint: fingerprintConversationalIntakeReview(review.data),
    issuedAtMs: nowMs,
    expiresAtMs: nowMs + RECEIPT_TTL_MS,
  };
  return { ...receipt, signature: sign(receipt, secret) };
}

export function verifyConversationalReviewReceipt(
  rawReceipt: unknown,
  rawReview: unknown,
  authenticatedUserId: string,
  secret: string,
  nowMs = Date.now(),
): ConversationalReviewReceipt {
  requireSecret(secret);
  const receipt = ConversationalReviewReceiptSchema.safeParse(rawReceipt);
  const review = ConversationalIntakeReviewSchema.safeParse(rawReview);
  if (!receipt.success || !review.success || !Number.isInteger(nowMs) || nowMs < 0) return deny();
  if (receipt.data.userId !== authenticatedUserId
    || receipt.data.reviewFingerprint !== fingerprintConversationalIntakeReview(review.data)
    || nowMs < receipt.data.issuedAtMs - 60_000
    || nowMs >= receipt.data.expiresAtMs) return deny();
  const expected = Buffer.from(sign({
    schemaVersion: receipt.data.schemaVersion,
    userId: receipt.data.userId,
    reviewFingerprint: receipt.data.reviewFingerprint,
    issuedAtMs: receipt.data.issuedAtMs,
    expiresAtMs: receipt.data.expiresAtMs,
  }, secret), "hex");
  const provided = Buffer.from(receipt.data.signature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return deny();
  return receipt.data;
}
