import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRepository = { get: vi.fn(), list: vi.fn(), review: vi.fn() };
const mockRequireUser = vi.fn();

vi.mock("@/lib/auth/requireUser", () => ({ requireUser: mockRequireUser }));
vi.mock("@/lib/application/opportunity-review-repository", () => ({
  createOpportunityReviewRepository: () => mockRepository,
}));

const opportunityId = "6a4b2e8e-f3c8-45be-a1cb-9abc12345678";
const timestamp = "2026-10-05T12:00:00.000Z";

function detail(text: string) {
  return {
    id: opportunityId, state: "HUMAN_REVIEW",
    signal: { family: "DETECTED_PROBLEM", subtype: "website" },
    company: { name: "Acme Example", domain: "acme.example", confidence: 0.92 },
    assessment: {
      decision: "REVIEW", confidence: 0.88, evidenceStrength: 0.9,
      freshness: 1, commercialImpact: 0.8, icpFit: 0.85, actionability: 0.8,
      problemStatement: "The homepage returns an unavailable page.",
    },
    evidenceCount: 1, evidenceStatus: "COMPLETE", latestReview: null,
    createdAt: timestamp, updatedAt: timestamp,
    evidence: [{
      id: "9c6d40a0-15ea-47d0-c3ed-bcde34567890", sourceUrl: "https://example.com/research",
      provider: "exa", capturedAt: timestamp, confidence: 0.9,
      verificationMethod: "normalized_public_source_capture", contentHash: "a".repeat(64),
      facts: { problem: { observedCondition: text } },
    }],
    limitations: [],
  };
}

describe("Opportunity review API text sanitization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireUser.mockResolvedValue({ user: { id: "member-1" }, supabase: {}, response: null });
  });

  it.each([
    "Profile: jane.example.com/in/jane",
    "Profile: linkedin.com/in/x",
    "Reference: example.co.uk/path",
  ])("does not serialize protocol-less domain paths: %s", async text => {
    mockRepository.get.mockResolvedValue(detail(text));
    const { GET } = await import("@/app/api/opportunities/[id]/route");

    const response = await GET(new NextRequest(`http://localhost/api/opportunities/${opportunityId}`), {
      params: Promise.resolve({ id: opportunityId }),
    });

    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain(text);
  });

  it("preserves valid business prose in an authenticated detail response", async () => {
    const prose = "Conversion fell 12.5%; the home page now returns an error.";
    const safe = detail(prose);
    safe.assessment!.problemStatement = prose;
    mockRepository.get.mockResolvedValue(safe);
    const { GET } = await import("@/app/api/opportunities/[id]/route");

    const response = await GET(new NextRequest(`http://localhost/api/opportunities/${opportunityId}`), {
      params: Promise.resolve({ id: opportunityId }),
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain(prose);
  });

  it.each([
    ["Unicode SMTPUTF8 path", "https://example.com/用户@example.com", null],
    ["ASCII address path", "https://example.com/posts/user@example.com", null],
    ["percent-encoded path", "https://example.com/in/jane%2Edoe", null],
    ["userinfo", "https://user@example.com/posts/abc-123", null],
    ["malformed port", "https://example.com:99999/posts/abc-123", null],
    ["numeric hostname", "https://999.999.999.999/posts/abc-123", null],
    ["backslash path", "https://example.com/posts\\abc-123", null],
    ["encoded query/token", "https://example.com/posts/abc-123?token=secret%40example.com#private", "https://example.com/posts/abc-123"],
    ["normalized safe path", "HTTPS://EXAMPLE.COM/posts/abc-123", "https://example.com/posts/abc-123"],
    ["root URL", "https://EXAMPLE.COM", "https://example.com/"],
    ["trailing slash", "HTTPS://EXAMPLE.COM/posts/", "https://example.com/posts/"],
    ["hex loopback", "https://0x7f.0.0.1/x", null], ["short hex loopback", "https://0x7f.1/x", null], ["octal loopback", "https://0177.0.0.1/x", null],
    ["integer loopback", "https://2130706433/x", null], ["short decimal loopback", "https://127.1/x", null], ["numeric subdomain", "https://123.example.com/path", "https://123.example.com/path"],
    ["leading tab", "\thttps://example.com/posts/abc-123", null], ["trailing newline", "https://example.com/posts/abc-123\r\n", null], ["padded spaces", " https://example.com/posts/abc-123 ", null],
  ] as const)("returns only allowlisted source URL data for %s", async (_label, sourceUrl, expected) => {
    const candidate = detail("The homepage returns an unavailable page.");
    candidate.evidence[0].sourceUrl = sourceUrl;
    mockRepository.get.mockResolvedValue(candidate);
    const { GET } = await import("@/app/api/opportunities/[id]/route");

    const response = await GET(new NextRequest(`http://localhost/api/opportunities/${opportunityId}`), {
      params: Promise.resolve({ id: opportunityId }),
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(body).data.evidence[0].sourceUrl).toBe(expected);
    expect(body).not.toMatch(/token=secret|#private|\?/);
  });
});
