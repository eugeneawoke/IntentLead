import { describe, it, expect, vi, beforeEach } from "vitest";
import type { getServerClient } from "@/lib/supabase/client";

type ServerClient = ReturnType<typeof getServerClient>;

function authClientWithUser(user: { id: string; email?: string } | null): ServerClient {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
  };
  return client as unknown as ServerClient;
}

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
    vi.mocked(getServerClient).mockReturnValueOnce(
      authClientWithUser({ id: "user-123", email: "test@example.com" })
    );

    const { requireUser } = await import("@/lib/auth/requireUser");
    const result = await requireUser();
    expect(result.user?.id).toBe("user-123");
    expect(result.response).toBeNull();
  });
});
