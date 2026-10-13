import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/errors";

const mockRequireUser = vi.fn();
const mockCreateRepository = vi.fn();
const mockListOpportunities = vi.fn();
const mockGetOpportunity = vi.fn();
const mockSubmitReview = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/application/opportunity-review-repository", () => ({
  createOpportunityReviewRepository: mockCreateRepository,
}));
vi.mock("@/lib/application/opportunity-review", () => ({
  listOpportunitiesForReview: mockListOpportunities,
  getOpportunityForReview: mockGetOpportunity,
  submitOpportunityReview: mockSubmitReview,
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() },
}));

const listPayload = { items: [], nextCursor: null, hasMore: false };
const detailPayload = {
  id: "6a4b2e8e-f3c8-45be-a1cb-9abc12345678",
  state: "HUMAN_REVIEW",
  signal: { family: "DETECTED_PROBLEM", subtype: "market_presence" },
  company: { name: "Acme Example", domain: "acme.example", confidence: 0.92 },
  assessment: null,
  evidence: [],
  evidenceCount: 0,
  evidenceStatus: "MISSING",
  latestReview: null,
  limitations: ["One or more referenced evidence items are missing or tombstoned."],
  createdAt: "2026-10-05T12:00:00.000Z",
  updatedAt: "2026-10-05T12:00:00.000Z",
};

function authAs(userId: string) {
  mockRequireUser.mockResolvedValue({ user: { id: userId }, supabase: { authUser: userId }, response: null });
}

function authFail() {
  mockRequireUser.mockResolvedValue({
    user: null,
    supabase: null,
    response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  });
}

function getList(query = "") {
  return import("@/app/api/opportunities/route").then(({ GET }) =>
    GET(new NextRequest(`http://localhost/api/opportunities${query}`)),
  );
}

function getDetail(id = detailPayload.id) {
  return import("@/app/api/opportunities/[id]/route").then(({ GET }) =>
    GET(new NextRequest(`http://localhost/api/opportunities/${id}`), { params: Promise.resolve({ id }) }),
  );
}

function postReview(body: unknown, header = "review-key-0001", id = detailPayload.id) {
  return import("@/app/api/opportunities/[id]/review/route").then(({ POST }) =>
    POST(new NextRequest(`http://localhost/api/opportunities/${id}/review`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": header },
      body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) }),
  );
}

describe("Opportunity review API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authAs("owner-1");
    mockCreateRepository.mockReturnValue({ kind: "authenticated-repository" });
    mockListOpportunities.mockResolvedValue(listPayload);
    mockGetOpportunity.mockResolvedValue(detailPayload);
    mockSubmitReview.mockResolvedValue({
      opportunityId: detailPayload.id, state: "ACCEPTED", decision: "ACCEPTED",
      reason: "RELEVANT", reviewedAt: "2026-10-05T12:00:00.000Z", replayed: false,
    });
  });

  it.each(["/api/opportunities", `/api/opportunities/${detailPayload.id}`])(
    "returns 401 for anonymous reads of %s",
    async path => {
      authFail();
      const response = path.endsWith("opportunities") ? await getList() : await getDetail();
      expect(response.status).toBe(401);
    },
  );

  it("returns 401 for anonymous review commands", async () => {
    authFail();
    const response = await postReview({ decision: "ACCEPTED", reason: "RELEVANT", note: null, idempotencyKey: "review-key-0001" });
    expect(response.status).toBe(401);
    expect(mockSubmitReview).not.toHaveBeenCalled();
  });

  it.each(["owner-1", "member-1"])("allows authenticated owner/member list and detail access (%s)", async userId => {
    authAs(userId);

    const listResponse = await getList("?limit=10");
    const detailResponse = await getDetail();

    expect(listResponse.status).toBe(200);
    expect((await listResponse.json()).data).toEqual(listPayload);
    expect(detailResponse.status).toBe(200);
    expect((await detailResponse.json()).data).toEqual(detailPayload);
    expect(mockListOpportunities).toHaveBeenCalledWith(userId, expect.any(URLSearchParams), expect.anything());
    expect(mockGetOpportunity).toHaveBeenCalledWith(userId, detailPayload.id, expect.anything());
  });

  it("returns a non-enumerating 404 for an outsider", async () => {
    authAs("outsider-1");
    mockGetOpportunity.mockRejectedValue(new ApplicationError("NOT_FOUND", "Opportunity not found"));

    const response = await getDetail();

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: { code: "NOT_FOUND", message: "Opportunity not found" } });
  });

  it("passes the authenticated cookie client and exact idempotency header into the review service", async () => {
    authAs("member-1");
    const body = { decision: "REJECTED", reason: "WEAK_SIGNAL", note: null, idempotencyKey: "review-key-0001" };

    const response = await postReview(body);

    expect(response.status).toBe(200);
    expect(mockCreateRepository).toHaveBeenCalledWith({ authUser: "member-1" });
    expect(mockSubmitReview).toHaveBeenCalledWith("member-1", detailPayload.id, body, "review-key-0001", expect.anything());
  });

  it("returns structured stale-review conflicts without changing auth behavior", async () => {
    mockSubmitReview.mockRejectedValue(new ApplicationError("CONFLICT", "Opportunity is no longer awaiting review"));

    const response = await postReview({ decision: "ACCEPTED", reason: "RELEVANT", note: null, idempotencyKey: "review-key-0001" });

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("CONFLICT");
  });

});
