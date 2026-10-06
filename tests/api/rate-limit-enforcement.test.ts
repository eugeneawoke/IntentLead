import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), from: vi.fn(), limit: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase/client", () => ({ getServiceClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.limit }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: { from: mocks.from }, response: null });
  mocks.limit.mockResolvedValue(true);
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), lte: vi.fn(() => query),
    insert: vi.fn(() => query),
    single: vi.fn().mockResolvedValue({ data: { id: "campaign" }, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [{ id: "workspace" }], error: null }).then(resolve),
  };
  mocks.from.mockReturnValue(query);
});

describe("campaign rate limit", () => {
  it("waits for an asynchronous denial before any database access", async () => {
    const { POST } = await import("@/app/api/campaigns/route");
    let decide!: (allowed: boolean) => void;
    mocks.limit.mockReturnValue(new Promise<boolean>((resolve) => { decide = resolve; }));
    const request = POST(new NextRequest("http://localhost/api/campaigns", {
      method: "POST", body: JSON.stringify({ what_selling: "service" }),
    }));
    await Promise.resolve();
    expect(mocks.from).not.toHaveBeenCalled();
    decide(false);
    expect((await request).status).toBe(429);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("permits an asynchronously allowed campaign", async () => {
    const { POST } = await import("@/app/api/campaigns/route");
    expect((await POST(new NextRequest("http://localhost/api/campaigns", {
      method: "POST", body: JSON.stringify({ what_selling: "service" }),
    }))).status).toBe(201);
  });
});
