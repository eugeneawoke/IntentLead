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
});
