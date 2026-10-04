import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(), from: vi.fn(), rpc: vi.fn(), limit: vi.fn(), stream: vi.fn(), update: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase/client", () => ({ getServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: mocks.limit }));
vi.mock("ai", () => ({ streamText: mocks.stream, tool: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ upsertChunks: vi.fn() }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, supabase: { from: mocks.from }, response: null });
  mocks.limit.mockResolvedValue(true);
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.stream.mockReturnValue({ toDataStreamResponse: () => new Response("stream") });
  const query = {
    select: vi.fn(() => query), eq: vi.fn(() => query), lte: vi.fn(() => query),
    insert: vi.fn(() => query), update: mocks.update.mockImplementation(() => query),
    single: vi.fn().mockResolvedValue({ data: { id: "workspace", plan: "free", chat_messages_today: 0, chat_messages_reset_at: new Date().toISOString() }, error: null }),
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

describe("chat atomic quota boundary", () => {
  async function chat(mode = "plan") {
    const { POST } = await import("@/app/api/chat/route");
    return POST(new NextRequest("http://localhost/api/chat", {
      method: "POST", body: JSON.stringify({ message: "Help", mode }),
    }));
  }

  it.each(["plan", "strategy"])("reserves %s quota through one owner-bound RPC", async (mode) => {
    expect((await chat(mode)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("intentlead_consume_chat_quota", {
      p_workspace_id: "workspace", p_user_id: "owner",
    });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("stops before model invocation when quota is exhausted", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    expect((await chat()).status).toBe(429);
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it("fails closed on quota database failure", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    expect((await chat()).status).toBe(503);
    expect(mocks.stream).not.toHaveBeenCalled();
  });
});
