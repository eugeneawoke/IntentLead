import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), service: vi.fn(), approve: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/security/strict-rate-limit", () => ({ checkStrictRateLimit: mocks.limit }));
vi.mock("@/lib/supabase/client", () => ({ getServiceClient: mocks.service }));
vi.mock("@/lib/application/conversational-intake-approval-api", () => ({ approveConversationalIntake: mocks.approve }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("INTENTLEAD_REVIEW_RECEIPT_SECRET", "configured-server-only-secret");
  mocks.auth.mockResolvedValue({ user: { id: "owner-1" }, response: null });
  mocks.limit.mockResolvedValue(true);
  mocks.service.mockReturnValue({ service: true });
  mocks.approve.mockResolvedValue({ discoveryBriefId: "brief-1", created: true });
});

describe("conversational intake approval API", () => {
  it("uses only the authenticated user and saves a DRAFT without a run action", async () => {
    const { POST } = await import("@/app/api/conversational-intake/approve/route");
    const body = { schemaVersion: 1, approval: { clientUserId: "attacker" }, reviewReceipt: {} };
    const response = await POST(new NextRequest("http://localhost/api/conversational-intake/approve", {
      method: "POST", body: JSON.stringify(body),
    }));
    expect(response.status).toBe(201);
    expect(mocks.approve).toHaveBeenCalledWith(
      { service: true }, "owner-1", body, "configured-server-only-secret",
    );
  });

  it("preserves auth, rate-limit and application-error boundaries", async () => {
    const { POST } = await import("@/app/api/conversational-intake/approve/route");
    const request = () => new NextRequest("http://localhost/api/conversational-intake/approve", {
      method: "POST", body: "{}",
    });
    mocks.auth.mockResolvedValueOnce({ user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await POST(request())).status).toBe(401);
    mocks.limit.mockResolvedValueOnce(false);
    expect((await POST(request())).status).toBe(429);
    mocks.approve.mockRejectedValueOnce(new ApplicationError("FORBIDDEN", "Receipt rejected"));
    expect((await POST(request())).status).toBe(403);
  });
});
