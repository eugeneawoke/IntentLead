import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), stream: vi.fn(), chunks: vi.fn(), auth: vi.fn(),
}));
vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mocks.auth }));
vi.mock("@/lib/supabase/client", () => ({
  getServiceClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
vi.mock("@/lib/ratelimit", () => ({ checkRateLimit: vi.fn().mockResolvedValue(true) }));
vi.mock("ai", () => ({ streamText: mocks.stream, tool: vi.fn() }));
vi.mock("@ai-sdk/openai", () => ({ openai: vi.fn() }));
vi.mock("@/lib/rag/embed", () => ({ upsertChunks: mocks.chunks }));
vi.mock("@/lib/utils/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

const scanId = "00000000-0000-4000-8000-000000000001";
const scan = {
  id: scanId, user_id: "owner", status: "done", url: "https://example.test",
  results: { businessContext: { detectedService: "Private service" } },
};
let storedScan: Record<string, unknown> | null;

beforeEach(() => {
  vi.clearAllMocks();
  storedScan = { ...scan };
  mocks.auth.mockResolvedValue({ user: { id: "owner" }, response: null });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  mocks.chunks.mockResolvedValue(undefined);
  mocks.stream.mockReturnValue({ toDataStreamResponse: () => new Response("stream") });
  mocks.from.mockImplementation((table: string) => {
    const filters: Record<string, unknown> = {};
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((key: string, value: unknown) => { filters[key] = value; return query; }),
      single: vi.fn(async () => {
        const row = table === "scans" ? storedScan : { id: "workspace", owner_id: "owner", credits_remaining: 10 };
        return { data: row && Object.entries(filters).every(([key, value]) => row[key as keyof typeof row] === value) ? row : null, error: null };
      }),
    };
    return query;
  });
});

async function callReport() {
  const { GET } = await import("@/app/api/glook/report/[scanId]/route");
  return GET(new NextRequest(`http://localhost/api/glook/report/${scanId}`), {
    params: Promise.resolve({ scanId }),
  });
}

async function callChat() {
  const { POST } = await import("@/app/api/chat/route");
  return POST(new NextRequest("http://localhost/api/chat", {
    method: "POST", body: JSON.stringify({ scanId, message: "Help me" }),
  }));
}

describe.each([["report", callReport], ["chat warm entry", callChat]] as const)("Glook %s ownership", (_, call) => {
  it("allows the owner of a completed scan", async () => {
    expect((await call()).status).toBe(200);
  });

  it.each(["foreign", "missing", "not-ready"])("returns the same 404 for %s scans", async (kind) => {
    if (kind === "foreign") storedScan = { ...scan, user_id: "someone-else" };
    if (kind === "missing") storedScan = null;
    if (kind === "not-ready") storedScan = { ...scan, status: "running" };
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, error: "Scan not found" });
    expect(mocks.stream).not.toHaveBeenCalled();
    expect(mocks.chunks).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
