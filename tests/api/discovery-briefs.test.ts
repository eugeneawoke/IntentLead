import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { ApplicationError } from "@/lib/application/errors";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), limit: vi.fn(), create: vi.fn(), list: vi.fn(), context: vi.fn(), remove: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.limit }));
vi.mock("@/lib/application/discovery-briefs", () => ({ createDiscoveryBrief: mocks.create, listDiscoveryBriefs: mocks.list }));
vi.mock("@/lib/application/context", () => ({ createApplicationContext: mocks.context }));
vi.mock("@/lib/application/data-lifecycle", () => ({ deleteDiscoveryBrief: mocks.remove }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner-1" }, supabase: {}, response: null });
  mocks.limit.mockResolvedValue(true);
  mocks.list.mockResolvedValue([{ id: "brief-1" }]);
  mocks.create.mockResolvedValue({ discoveryBriefId: "brief-1", created: true });
  mocks.context.mockResolvedValue({ discoveryBriefId: "brief-1" });
  mocks.remove.mockResolvedValue({ deleted: true });
});

describe("DiscoveryBrief API", () => {
  it("lists only the application-contract projection", async () => {
    const { GET } = await import("@/app/api/discovery-briefs/route");
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).data.discoveryBriefs).toEqual([{ id: "brief-1" }]);
    expect(mocks.list).toHaveBeenCalledWith({});
  });

  it("creates through the native command and maps idempotency conflicts", async () => {
    const { POST } = await import("@/app/api/discovery-briefs/route");
    const request = () => new NextRequest("http://localhost/api/discovery-briefs", {
      method: "POST", headers: { "Idempotency-Key": "create-brief-0001" }, body: JSON.stringify({ schemaVersion: 1 }),
    });
    expect((await POST(request())).status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({}, { schemaVersion: 1 }, "create-brief-0001");
    mocks.create.mockRejectedValue(new ApplicationError("CONFLICT", "Idempotency conflict"));
    expect((await POST(request())).status).toBe(409);
  });

  it("deletes only after owner-scoped context resolution", async () => {
    const { DELETE } = await import("@/app/api/discovery-briefs/[id]/route");
    const response = await DELETE(
      new NextRequest("http://localhost/api/discovery-briefs/brief-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "brief-1" }) },
    );
    expect(response.status).toBe(200);
    expect(mocks.context).toHaveBeenCalledWith({ authenticatedUserId: "owner-1", discoveryBriefId: "brief-1" }, {});
    expect(mocks.remove).toHaveBeenCalledWith({ discoveryBriefId: "brief-1" }, { schemaVersion: 1, discoveryBriefId: "brief-1" });
  });

  it("preserves authentication and deletion non-disclosure", async () => {
    const { DELETE } = await import("@/app/api/discovery-briefs/[id]/route");
    mocks.context.mockRejectedValue(new ApplicationError("NOT_FOUND", "DiscoveryBrief not found"));
    const request = new NextRequest("http://localhost/api/discovery-briefs/other", { method: "DELETE" });
    expect((await DELETE(request, { params: Promise.resolve({ id: "other" }) })).status).toBe(404);
    mocks.auth.mockResolvedValue({ user: null, supabase: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) });
    expect((await DELETE(request, { params: Promise.resolve({ id: "other" }) })).status).toBe(401);
  });
});
