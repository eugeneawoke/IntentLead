import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
  })),
}));

// Mock @supabase/ssr
vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(),
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "No session" } }),
    },
  })),
}));

// Mock lib/supabase/client
vi.mock("@/lib/supabase/client", () => ({
  getServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: "No session" } }),
    },
  })),
  getServiceClient: vi.fn(),
  getBrowserClient: vi.fn(),
}));

describe("requireUser", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns 401 response when no user session", async () => {
    const { requireUser } = await import("@/lib/auth/requireUser");
    const result = await requireUser();
    expect(result.user).toBeNull();
    expect(result.response).not.toBeNull();
    // Check status 401
    expect(result.response?.status).toBe(401);
  });

  it("returns user when session valid", async () => {
    const { getServerClient } = await import("@/lib/supabase/client");
    vi.mocked(getServerClient).mockReturnValueOnce({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        }),
      },
    } as ReturnType<typeof getServerClient>);

    const { requireUser } = await import("@/lib/auth/requireUser");
    const result = await requireUser();
    expect(result.user?.id).toBe("user-123");
    expect(result.response).toBeNull();
  });
});
