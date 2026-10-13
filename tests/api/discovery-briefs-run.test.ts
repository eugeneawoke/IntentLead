import { beforeEach, describe, expect, it, vi } from "vitest";
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

const context = {
  authenticatedUserId: "owner-1", workspace: { id: "workspace-1", role: "OWNER" },
  discoveryBriefId: "brief-1", traceId: "trace-1", permissions: new Set(["SOURCE_SEARCH"]),
  budget: { currency: "USD", maxTotalCost: 0, maxProviderCalls: 0 }, marketProfile: { id: "EN_DISCOVERY_ONLY" },
};

function callRoute(headers: Record<string, string> = {}) {
  const req = new NextRequest("http://localhost/api/discovery-briefs/brief-1/run", { method: "POST", headers });
  return import("@/app/api/discovery-briefs/[id]/run/route").then(({ POST }) =>
    POST(req, { params: Promise.resolve({ id: "brief-1" }) }));
}

describe("POST /api/discovery-briefs/:id/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue(true);
    mockRequireUser.mockResolvedValue({ user: { id: "owner-1" }, supabase: {}, response: null });
    mockCreateContext.mockResolvedValue(context);
    mockStart.mockResolvedValue({ jobId: "job-1" });
  });

  it("enqueues the server-authorized DiscoveryBrief before returning 202", async () => {
    const response = await callRoute({ "Idempotency-Key": "request-0001" });
    expect(response.status).toBe(202);
    expect(mockCreateContext).toHaveBeenCalledWith({ authenticatedUserId: "owner-1", discoveryBriefId: "brief-1" }, {});
    expect(mockStart).toHaveBeenCalledWith(context, {
      schemaVersion: 1, discoveryBriefId: "brief-1", idempotencyKey: "request-0001",
    });
    expect(mockDispatch).toHaveBeenCalledWith("job-1");
  });

  it("keeps accepted work successful when the wake hint fails", async () => {
    mockDispatch.mockImplementation(() => { throw new Error("worker offline"); });
    expect((await callRoute()).status).toBe(202);
    expect(mockLoggerError).toHaveBeenCalled();
  });

  it("preserves non-disclosing authority and authentication denials", async () => {
    mockCreateContext.mockRejectedValue(new ApplicationError("NOT_FOUND", "DiscoveryBrief not found"));
    expect((await callRoute()).status).toBe(404);
    mockRequireUser.mockResolvedValue({ user: null, supabase: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await callRoute()).status).toBe(401);
  });
});
