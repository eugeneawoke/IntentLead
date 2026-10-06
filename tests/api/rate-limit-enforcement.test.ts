import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), limit: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.limit }));
vi.mock("@/lib/application/discovery-briefs", () => ({
  createDiscoveryBrief: mocks.create,
  listDiscoveryBriefs: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: {}, response: null });
  mocks.limit.mockResolvedValue(true);
  mocks.create.mockResolvedValue({ discoveryBriefId: "brief-1", created: true });
});

describe("DiscoveryBrief rate limit", () => {
  it("waits for an asynchronous denial before persistence", async () => {
    const { POST } = await import("@/app/api/discovery-briefs/route");
    let decide!: (allowed: boolean) => void;
    mocks.limit.mockReturnValue(new Promise<boolean>(resolve => { decide = resolve; }));
    const request = POST(new NextRequest("http://localhost/api/discovery-briefs", {
      method: "POST", headers: { "Idempotency-Key": "create-brief-0001" }, body: JSON.stringify({}),
    }));
    await Promise.resolve();
    expect(mocks.create).not.toHaveBeenCalled();
    decide(false);
    expect((await request).status).toBe(429);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("permits an asynchronously allowed native command", async () => {
    const { POST } = await import("@/app/api/discovery-briefs/route");
    const response = await POST(new NextRequest("http://localhost/api/discovery-briefs", {
      method: "POST", headers: { "Idempotency-Key": "create-brief-0001" }, body: JSON.stringify({}),
    }));
    expect(response.status).toBe(201);
  });
});
