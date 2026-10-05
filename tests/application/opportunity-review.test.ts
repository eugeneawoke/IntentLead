import { describe, expect, it, vi } from "vitest";
import {
  getOpportunityForReview,
  listOpportunitiesForReview,
  submitOpportunityReview,
  type OpportunityReviewRepository,
} from "@/lib/application/opportunity-review";
import { ApplicationError } from "@/lib/application/errors";

const opportunityId = "6a4b2e8e-f3c8-45be-a1cb-9abc12345678";
const secondOpportunityId = "7b5c3f9f-04d9-46cf-b2dc-abcd23456789";
const capturedAt = "2026-10-05T12:00:00.000Z";

function item(id = opportunityId) {
  return {
    id,
    state: "HUMAN_REVIEW",
    signal: { family: "DETECTED_PROBLEM", subtype: "website" },
    company: { name: "Acme Example", domain: "acme.example", confidence: 0.92 },
    assessment: {
      decision: "REVIEW", confidence: 0.88, evidenceStrength: 0.9,
      freshness: 1, commercialImpact: 0.8, icpFit: 0.85, actionability: 0.8,
      problemStatement: "The observed site issue may be affecting customer conversion.",
    },
    evidenceCount: 1,
    evidenceStatus: "COMPLETE",
    latestReview: null,
    createdAt: capturedAt,
    updatedAt: capturedAt,
  };
}

function detail(id = opportunityId) {
  return {
    ...item(id),
    evidence: [{
      id: "9c6d40a0-15ea-47d0-c3ed-bcde34567890",
      sourceUrl: "https://example.com/research",
      provider: "exa",
      capturedAt,
      confidence: 0.9,
      verificationMethod: "normalized_public_source_capture",
      contentHash: "a".repeat(64),
      facts: {
        companyName: "Acme Example", companyDomain: "acme.example",
        problem: { observedCondition: "The homepage returned an unavailable page." },
      },
    }],
    limitations: ["Model interpretation is separate from source facts."],
  };
}

function repository(overrides: Partial<OpportunityReviewRepository> = {}): OpportunityReviewRepository {
  return {
    list: vi.fn().mockResolvedValue({ rows: [item()], hasMore: false }),
    get: vi.fn().mockResolvedValue(detail()),
    review: vi.fn().mockResolvedValue({
      opportunityId,
      state: "HUMAN_REVIEW",
      decision: "ACCEPTED",
      reason: "RELEVANT",
      reviewedAt: capturedAt,
      replayed: false,
    }),
    ...overrides,
  };
}

describe("Opportunity review application service", () => {
  it("validates bounded pagination and encodes a deterministic next cursor", async () => {
    const repo = repository({
      list: vi.fn().mockResolvedValue({ rows: [item(), item(secondOpportunityId)], hasMore: true }),
    });

    const result = await listOpportunitiesForReview("member-1", new URLSearchParams("limit=1"), repo);

    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ limit: 1, after: null }));
  });

  it.each([
    ["limit=0", "INVALID_INPUT"],
    ["limit=51", "INVALID_INPUT"],
    ["limit=1.5", "INVALID_INPUT"],
    ["limit=1&workspaceId=foreign", "INVALID_INPUT"],
    ["cursor=not-a-cursor", "INVALID_INPUT"],
  ])("rejects strict pagination query %s", async (query, code) => {
    await expect(listOpportunitiesForReview("member-1", new URLSearchParams(query), repository()))
      .rejects.toMatchObject({ code });
  });

  it("keeps list and detail DTOs closed over discovery data", async () => {
    const repo = repository();
    const list = await listOpportunitiesForReview("owner-1", new URLSearchParams(), repo);
    const result = await getOpportunityForReview("member-1", opportunityId, repo);
    const json = JSON.stringify({ list, result }).toLowerCase();

    for (const forbidden of ["person", "contact", "email", "draft", "outreach", "outcome", "credit", "lead"]) {
      expect(json).not.toContain(`\"${forbidden}`);
    }
  });

  it("represents missing or tombstoned evidence without inventing source facts", async () => {
    const repo = repository({
      get: vi.fn().mockResolvedValue({
        ...detail(), evidence: [], evidenceCount: 0, evidenceStatus: "MISSING",
        limitations: ["One or more referenced evidence items are missing or tombstoned."],
      }),
    });

    const result = await getOpportunityForReview("owner-1", opportunityId, repo);

    expect(result.evidence).toEqual([]);
    expect(result.evidenceStatus).toBe("MISSING");
    expect(result.limitations).toContain("Some referenced evidence is missing or tombstoned.");
  });

  it("keeps sanitized observed facts distinct from bounded model interpretation", async () => {
    const result = await getOpportunityForReview("member-1", opportunityId, repository());

    expect(result.evidence[0].facts.problem?.observedCondition).toBe("The homepage returned an unavailable page.");
    expect(result.assessment?.problemStatement).toBe("The observed site issue may be affecting customer conversion.");
    await expect(getOpportunityForReview("member-1", opportunityId, repository({
      get: vi.fn().mockResolvedValue({
        ...detail(),
        assessment: { ...detail().assessment, problemStatement: "Contact owner@example.test" },
      }),
    }))).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
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
  ] as const)("applies the source URL allowlist to %s", async (_label, sourceUrl, expected) => {
    const candidate = detail();
    candidate.evidence[0].sourceUrl = sourceUrl;
    const result = await getOpportunityForReview("member-1", opportunityId, repository({
      get: vi.fn().mockResolvedValue(candidate),
    }));

    expect(result.evidence[0].sourceUrl).toBe(expected);
    expect(JSON.stringify(result)).not.toMatch(/token=secret|#private|\?/);
  });

  it.each([
    "Profile: jane.example.com/in/jane",
    "Profile: linkedin.com/in/x",
    "Reference: example.co.uk/path",
  ])("rejects protocol-less domain paths in facts and interpretation: %s", async text => {
    const unsafeFact = detail();
    unsafeFact.evidence[0].facts.problem = { observedCondition: text };
    await expect(getOpportunityForReview("member-1", opportunityId, repository({
      get: vi.fn().mockResolvedValue(unsafeFact),
    }))).rejects.toMatchObject({ code: "INTERNAL_ERROR" });

    const unsafeInterpretation = detail();
    unsafeInterpretation.assessment!.problemStatement = text;
    await expect(getOpportunityForReview("member-1", opportunityId, repository({
      get: vi.fn().mockResolvedValue(unsafeInterpretation),
    }))).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("preserves ordinary business prose with punctuation and percentages", async () => {
    const text = "Conversion fell 12.5%; the home page now returns an error.";
    const candidate = detail();
    candidate.evidence[0].facts.problem = { observedCondition: text };
    candidate.assessment!.problemStatement = text;

    const result = await getOpportunityForReview("member-1", opportunityId, repository({
      get: vi.fn().mockResolvedValue(candidate),
    }));

    expect(result.evidence[0].facts.problem?.observedCondition).toBe(text);
    expect(result.assessment?.problemStatement).toBe(text);
  });

  it.each([
    "jane.example.com/in/jane",
    "linkedin.com/in/x",
    "example.co.uk/path",
  ])("rejects protocol-less domain paths in submitted review notes: %s", async note => {
    const repo = repository();

    await expect(submitOpportunityReview("member-1", opportunityId, {
      decision: "NEEDS_RESEARCH", reason: "OTHER", note, idempotencyKey: "review-protocol-url-001",
    }, "review-protocol-url-001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repo.review).not.toHaveBeenCalled();
  });

  it("does not serialize unexpected contact or downstream fields from a repository", async () => {
    const repo = repository({
      get: vi.fn().mockResolvedValue({ ...detail(), contactEmail: "person@example.test" }),
    });

    await expect(getOpportunityForReview("owner-1", opportunityId, repo))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("returns a non-enumerating not-found result for an inaccessible Opportunity", async () => {
    const repo = repository({ get: vi.fn().mockResolvedValue(null) });

    await expect(getOpportunityForReview("outsider-1", opportunityId, repo))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("requires an authenticated actor before accessing the repository", async () => {
    const repo = repository();

    await expect(getOpportunityForReview(" ", opportunityId, repo))
      .rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(repo.get).not.toHaveBeenCalled();
  });

  it("requires the idempotency header to match the strict command body", async () => {
    const repo = repository();

    await expect(submitOpportunityReview("member-1", opportunityId, {
      decision: "ACCEPTED", reason: "RELEVANT", note: null, idempotencyKey: "review-key-0001",
    }, "review-key-0002", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repo.review).not.toHaveBeenCalled();
  });

  it("rejects client authority and downstream state fields", async () => {
    const repo = repository();

    await expect(submitOpportunityReview("member-1", opportunityId, {
      decision: "ACCEPTED", reason: "RELEVANT", note: null, idempotencyKey: "review-key-0001",
      workspaceId: "attacker-workspace", state: "OUTREACH_READY", email: "person@example.test",
    }, "review-key-0001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(repo.review).not.toHaveBeenCalled();
  });

  it("requires reasons for rejection and research, and a note for OTHER", async () => {
    const repo = repository();
    const base = { note: null, idempotencyKey: "review-key-0001" };

    await expect(submitOpportunityReview("member-1", opportunityId, {
      ...base, decision: "REJECTED",
    }, "review-key-0001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(submitOpportunityReview("member-1", opportunityId, {
      ...base, decision: "NEEDS_RESEARCH", reason: "OTHER",
    }, "review-key-0001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(submitOpportunityReview("member-1", opportunityId, {
      ...base, decision: "REJECTED", reason: "WRONG_PERSON",
    }, "review-key-0001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("rejects notes that could introduce contact details into review records", async () => {
    const repo = repository();

    await expect(submitOpportunityReview("member-1", opportunityId, {
      decision: "REJECTED", reason: "OTHER", note: "Email person@example.test", idempotencyKey: "review-key-0001",
    }, "review-key-0001", repo)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("accepts, rejects and marks research through only the three review decisions", async () => {
    for (const [decision, reason, note] of [
      ["ACCEPTED", "RELEVANT", null],
      ["REJECTED", "WEAK_SIGNAL", null],
      ["NEEDS_RESEARCH", "OTHER", "Need a stronger source."],
    ] as const) {
      const repo = repository();
      await submitOpportunityReview("member-1", opportunityId, {
        decision, reason, note, idempotencyKey: `review-key-${decision.toLowerCase()}`,
      }, `review-key-${decision.toLowerCase()}`, repo);
      expect(repo.review).toHaveBeenCalledWith(opportunityId, expect.objectContaining({ decision, reason, note }));
    }
  });

  it("maps an unknown repository failure to a non-sensitive application error", async () => {
    const repo = repository({ list: vi.fn().mockRejectedValue(new Error("person@example.test")) });

    await expect(listOpportunitiesForReview("member-1", new URLSearchParams(), repo))
      .rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    try {
      await listOpportunitiesForReview("member-1", new URLSearchParams(), repo);
    } catch (error) {
      expect(error).toBeInstanceOf(ApplicationError);
      expect((error as Error).message).not.toContain("person@example.test");
    }
  });
});
