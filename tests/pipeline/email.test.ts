import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock env vars
vi.stubEnv("PROSPEO_API_KEY", "test-prospeo");
vi.stubEnv("HUNTER_API_KEY", "test-hunter");
vi.stubEnv("APOLLO_API_KEY", "test-apollo");

function makeProspeoResponse(email: string | null) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      error: email === null,
      email: email ? { value: email, verification: { status: "VALID" } } : undefined,
    }),
    status: 200,
  } as Response);
}

function makeHunterResponse(email: string | null) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      data: email ? { email, verification: { status: "valid" } } : null,
    }),
    status: 200,
  } as Response);
}

function makeApolloResponse(email: string | null) {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      person: email ? { email } : null,
    }),
    status: 200,
  } as Response);
}

describe("email waterfall", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.resetModules();
  });

  it("returns email from Prospeo when found (never calls Hunter)", async () => {
    mockFetch.mockResolvedValueOnce(makeProspeoResponse("john@acme.com"));

    const { findEmail } = await import("@/worker/pipeline/email");
    const result = await findEmail("John Smith", "acme.com");

    expect(result.email).toBe("john@acme.com");
    expect(result.provider).toBe("prospeo");
    // Hunter and Apollo should NOT have been called
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("falls back to Hunter when Prospeo fails", async () => {
    mockFetch
      .mockResolvedValueOnce(makeProspeoResponse(null))          // Prospeo: not found
      .mockResolvedValueOnce(makeHunterResponse("john@acme.com")); // Hunter: found

    const { findEmail } = await import("@/worker/pipeline/email");
    const result = await findEmail("John Smith", "acme.com");

    expect(result.email).toBe("john@acme.com");
    expect(result.provider).toBe("hunter");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to Apollo when Prospeo and Hunter fail", async () => {
    mockFetch
      .mockResolvedValueOnce(makeProspeoResponse(null))
      .mockResolvedValueOnce(makeHunterResponse(null))
      .mockResolvedValueOnce(makeApolloResponse("john@acme.com"));

    const { findEmail } = await import("@/worker/pipeline/email");
    const result = await findEmail("John Smith", "acme.com");

    expect(result.email).toBe("john@acme.com");
    expect(result.provider).toBe("apollo");
  });

  it("returns null when all providers fail", async () => {
    mockFetch
      .mockResolvedValueOnce(makeProspeoResponse(null))
      .mockResolvedValueOnce(makeHunterResponse(null))
      .mockResolvedValueOnce(makeApolloResponse(null));

    const { findEmail } = await import("@/worker/pipeline/email");
    const result = await findEmail("John Smith", "acme.com");

    expect(result.email).toBeNull();
    expect(result.provider).toBeNull();
  });
});
