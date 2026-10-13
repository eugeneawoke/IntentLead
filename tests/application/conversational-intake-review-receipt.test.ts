import { describe, expect, it, vi } from "vitest";
import type { ApplicationSupabaseClient } from "@/lib/application/context";
import { approveConversationalIntake } from "@/lib/application/conversational-intake-approval-api";
import {
  issueConversationalReviewReceipt,
  verifyConversationalReviewReceipt,
} from "@/lib/application/conversational-intake-review-receipt";
import {
  conversationalIntakeApproval as approval,
  conversationalIntakeReview as review,
} from "@/tests/fixtures/conversational-intake";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "22222222-2222-4222-8222-222222222222";
const secret = "receipt-secret-with-at-least-32-bytes-for-tests";
const nowMs = Date.parse("2026-10-10T12:00:00.000Z");

describe("conversational review receipt", () => {
  it("binds a bounded receipt to the authenticated user and exact review", () => {
    const receipt = issueConversationalReviewReceipt(review, userId, secret, nowMs);
    expect(verifyConversationalReviewReceipt(receipt, review, userId, secret, nowMs + 1)).toEqual(receipt);
    expect(receipt.expiresAtMs - receipt.issuedAtMs).toBe(15 * 60_000);
  });

  it("rejects tampering, another user, another review, expiry and missing configuration", () => {
    const receipt = issueConversationalReviewReceipt(review, userId, secret, nowMs);
    const changedReview = { ...review, requestFingerprint: "c".repeat(64) };
    expect(() => verifyConversationalReviewReceipt({ ...receipt, signature: "0".repeat(64) }, review, userId, secret, nowMs)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => verifyConversationalReviewReceipt(receipt, review, otherUserId, secret, nowMs)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => verifyConversationalReviewReceipt(receipt, changedReview, userId, secret, nowMs)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => verifyConversationalReviewReceipt(receipt, review, userId, secret, receipt.expiresAtMs)).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => issueConversationalReviewReceipt(review, userId, "short", nowMs)).toThrow(expect.objectContaining({ code: "CAPABILITY_UNAVAILABLE" }));
  });

  it("verifies the receipt before service-role persistence and never starts a job", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        discoveryBriefId: "brief-1", workspaceId: "workspace-1", offerProfileId: "offer-1",
        icpDefinitionId: "icp-1", marketProfileId: "EN_DISCOVERY_ONLY", created: true,
      },
      error: null,
    });
    const rawApproval = approval();
    const result = await approveConversationalIntake(
      { rpc } as unknown as ApplicationSupabaseClient,
      userId,
      {
        schemaVersion: 1,
        approval: rawApproval,
        reviewReceipt: issueConversationalReviewReceipt(review, userId, secret, nowMs),
      },
      secret,
      nowMs + 1,
    );
    expect(result).toMatchObject({ discoveryBriefId: "brief-1", created: true });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[0]).toBe("intentlead_create_approved_discovery_brief");

    rpc.mockClear();
    const receipt = issueConversationalReviewReceipt(review, userId, secret, nowMs);
    await expect(approveConversationalIntake(
      { rpc } as unknown as ApplicationSupabaseClient,
      userId,
      {
        schemaVersion: 1,
        approval: rawApproval,
        reviewReceipt: { ...receipt, signature: "0".repeat(64) },
      },
      secret,
      nowMs + 1,
    )).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
