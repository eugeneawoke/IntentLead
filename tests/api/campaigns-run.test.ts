import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Unit tests for POST /api/campaigns/:id/run — credit gate logic.
 *
 * The route is tested by mocking its dependencies (requireUser, getServiceClient,
 * checkRateLimit, dispatchToWorker, logger) and calling the real POST handler.
 * This validates the 402 / 202 branching without needing a live Next.js server.
 */

// ── Dependency mocks ──────────────────────────────────────────────────────────

// requireUser — returns an authenticated user by default
const mockRequireUser = vi.fn();
vi.mock("@/lib/auth/requireUser", () => ({
  requireUser: mockRequireUser,
}));

// getServiceClient — wraps workspace queries; configure per test
const mockServiceFrom = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  getServiceClient: () => ({ from: mockServiceFrom }),
}));

// checkRateLimit — allow by default
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: vi.fn().mockReturnValue(true),
}));

// dispatchToWorker — fire-and-forget; we just verify it's called (or not)
const mockDispatch = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/auth/dispatchToWorker", () => ({
  dispatchToWorker: mockDispatch,
}));

// logger — suppress output in tests
vi.mock("@/lib/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAMPAIGN = { id: "campaign-1", workspace_id: "ws-1", status: "pending" };

function buildUserSupabaseMock(campaignOverride?: Partial<typeof CAMPAIGN>) {
  const campaign = { ...CAMPAIGN, ...campaignOverride };
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: campaign, error: null }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  };
}

function buildWorkspaceMock(workspace: Record<string, unknown>) {
  mockServiceFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: workspace, error: null }),
      }),
    }),
  });
}

async function callRoute(campaignId = "campaign-1") {
  // Dynamic import so vi.mock() hoisting applies
  const { POST } = await import("@/app/api/campaigns/[id]/run/route");
  const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
    method: "POST",
  });
  return POST(req, { params: Promise.resolve({ id: campaignId }) });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/campaigns/:id/run — credit gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 402 when free_converter_used=true and credits_remaining=0", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: buildUserSupabaseMock(),
      response: null,
    });
    buildWorkspaceMock({
      id: "ws-1",
      credits_remaining: 0,
      plan: "free",
      free_converter_used: true,
    });

    const res = await callRoute();

    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toContain("Insufficient credits");
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("returns 402 when credits_remaining=0 and plan is not free", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: buildUserSupabaseMock(),
      response: null,
    });
    buildWorkspaceMock({
      id: "ws-1",
      credits_remaining: 0,
      plan: "starter",
      free_converter_used: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(402);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("returns 202 and dispatches worker when credits_remaining > 0", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: buildUserSupabaseMock(),
      response: null,
    });
    buildWorkspaceMock({
      id: "ws-1",
      credits_remaining: 5,
      plan: "starter",
      free_converter_used: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(202);
    expect(mockDispatch).toHaveBeenCalledWith("campaign-1");
  });

  it("returns 202 for free plan first run (free_converter_used=false, credits=0)", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: buildUserSupabaseMock(),
      response: null,
    });
    buildWorkspaceMock({
      id: "ws-1",
      credits_remaining: 0,
      plan: "free",
      free_converter_used: false,
    });

    const res = await callRoute();

    expect(res.status).toBe(202);
    expect(mockDispatch).toHaveBeenCalledWith("campaign-1");
  });

  it("returns 401 when user is not authenticated", async () => {
    const { NextResponse } = await import("next/server");
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const res = await callRoute();

    expect(res.status).toBe(401);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("returns 404 when campaign does not exist", async () => {
    mockRequireUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        }),
      },
      response: null,
    });

    const res = await callRoute();

    expect(res.status).toBe(404);
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
