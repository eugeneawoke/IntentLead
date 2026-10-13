import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ service: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ getServiceClient: mocks.service }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  mocks.service.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
});

describe("strict rate limiter", () => {
  it("allows only an explicit successful database decision", async () => {
    const { checkStrictRateLimit } = await import("@/lib/security/strict-rate-limit");
    await expect(checkStrictRateLimit("approval:user-1", 10, 60_000)).resolves.toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("check_rate_limit", {
      p_key: "approval:user-1", p_max_requests: 10, p_window_seconds: 60,
    });
  });

  it("fails closed on missing configuration, RPC denial, RPC error and exceptions", async () => {
    const { checkStrictRateLimit } = await import("@/lib/security/strict-rate-limit");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    await expect(checkStrictRateLimit("approval:user-1", 10, 60_000)).resolves.toBe(false);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    mocks.rpc.mockResolvedValueOnce({ data: false, error: null });
    await expect(checkStrictRateLimit("approval:user-1", 10, 60_000)).resolves.toBe(false);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    await expect(checkStrictRateLimit("approval:user-1", 10, 60_000)).resolves.toBe(false);
    mocks.rpc.mockRejectedValueOnce(new Error("down"));
    await expect(checkStrictRateLimit("approval:user-1", 10, 60_000)).resolves.toBe(false);
  });
});
