import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/errors";

const mockRequireUser = vi.fn();
const mockCreateContext = vi.fn();
const mockStart = vi.fn();
const mockDispatch = vi.fn();
const mockRateLimit = vi.fn();
const mockLoggerError = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/application/context", () => ({ createApplicationContext: mockCreateContext }));
vi.mock("@/lib/application/opportunities", () => ({ startOpportunitySearch: mockStart }));
vi.mock("@/lib/auth/dispatchToWorker", () => ({ dispatchToWorker: mockDispatch }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mockRateLimit }));
vi.mock("@/lib/utils/logger", () => ({ logger: { error: mockLoggerError, info: vi.fn(), warn: vi.fn() } }));

const campaignContext = {
  authenticatedUserId: "owner-1",
  workspace: { id: "workspace-1", role: "OWNER" },
  campaignId: "campaign-1",
  discoveryBriefId: "brief-1",
  traceId: "trace-1",
  permissions: new Set(["SOURCE_SEARCH"]),
  budget: { currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 },
  marketProfile: { id: "EN_DISCOVERY_ONLY" },
};

function callRoute(headers: Record<string, string> = {}) {
  const req = new NextRequest("http://localhost/api/campaigns/campaign-1/run", {
    method: "POST",
    headers,
  });
  return import("@/app/api/campaigns/[id]/run/route").then(({ POST }) =>
    POST(req, { params: Promise.resolve({ id: "campaign-1" }) }),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe("POST /api/campaigns/:id/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
    mockRequireUser.mockResolvedValue({ user: { id: "owner-1" }, supabase: {}, response: null });
    mockCreateContext.mockResolvedValue(campaignContext);
    mockStart.mockResolvedValue({ jobId: "job-1" });
    mockDispatch.mockReturnValue(undefined);
  });

  it("waits for durable enqueue and atomic campaign transition before returning 202", async () => {
    const accepted = deferred<{ jobId: string }>();
    mockStart.mockReturnValue(accepted.promise);
    let routeSettled = false;
    const responsePromise = callRoute({ "Idempotency-Key": "request-1" }).then(response => {
      routeSettled = true;
      return response;
    });

    await vi.waitFor(() => expect(mockStart).toHaveBeenCalledWith(campaignContext, {
      schemaVersion: 1,
      campaignId: "campaign-1",
      idempotencyKey: "request-1",
    }));
    expect(routeSettled).toBe(false);
    expect(mockDispatch).not.toHaveBeenCalled();

    accepted.resolve({ jobId: "job-1" });
    const response = await responsePromise;

    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ jobId: "job-1", status: "queued" });
    expect(mockDispatch).toHaveBeenCalledWith("job-1");
  });

  it("keeps accepted work successful when the optional wake hint throws", async () => {
    mockDispatch.mockImplementation(() => { throw new Error("worker offline"); });

    const response = await callRoute({ "Idempotency-Key": "request-1" });

    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ jobId: "job-1", status: "queued" });
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("returns an honest setup conflict when no linked DiscoveryBrief or profile exists", async () => {
    mockCreateContext.mockRejectedValue(new ApplicationError("CONFLICT", "Discovery setup is incomplete"));

    const response = await callRoute();

    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("Discovery setup is incomplete");
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it("does not trust workspace input or perform a separate campaign mutation", async () => {
    const response = await callRoute({ "Idempotency-Key": "request-1" });

    expect(response.status).toBe(202);
    expect(mockCreateContext).toHaveBeenCalledWith(expect.objectContaining({
      authenticatedUserId: "owner-1",
      campaignId: "campaign-1",
    }), {});
    expect(mockStart).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ workspaceId: expect.anything() }));
  });

  it("preserves authentication and rate-limit denials", async () => {
    mockRequireUser.mockResolvedValue({
      user: null,
      supabase: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    expect((await callRoute()).status).toBe(401);

    mockRequireUser.mockResolvedValue({ user: { id: "owner-1" }, supabase: {}, response: null });
    mockRateLimit.mockResolvedValue(false);
    expect((await callRoute()).status).toBe(429);
    expect(mockStart).not.toHaveBeenCalled();
  });
});
