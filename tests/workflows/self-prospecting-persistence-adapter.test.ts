import { describe, expect, it, vi } from "vitest";
import type { LeasedJob, JobDatabaseClient } from "@/worker/jobs/repository";
import type { SelfProspectingPersistInput } from "@/types/self-prospecting";
import { createSupabaseSelfProspectingPersistence } from "@/worker/workflows/self-prospecting-persistence";

const job = {
  id: "10000000-0000-4000-8000-000000000001",
  lease: { owner: "fixture-worker", token: "10000000-0000-4000-8000-000000000002" },
} as unknown as LeasedJob;

function input(providerRunId: string | null): SelfProspectingPersistInput {
  return {
    schemaVersion: 1, candidateKey: "hackernews:item-1", modelDecision: null,
    groundedClaims: null, policyReasons: ["COMPANY_UNCERTAIN"],
    providerRuns: [{ id: "10000000-0000-4000-8000-000000000003", provider: "hackernews" }],
    sourceItems: [{
      id: "10000000-0000-4000-8000-000000000004", externalId: "item-1",
      sourceUrl: "https://news.ycombinator.com/item?id=1", content: "Public signal",
      structuredFacts: {}, contentHash: "a".repeat(64), capturedAt: "2026-10-05T12:00:00.000Z",
      publishedAt: null,
      provenance: { sourceType: "SOCIAL", sourceId: "10000000-0000-4000-8000-000000000004", providerRunId, rawArtifactId: null },
    }],
    evidenceItems: [], company: null,
    opportunity: {
      id: "10000000-0000-4000-8000-000000000005", workspaceId: "10000000-0000-4000-8000-000000000006",
      signal: { family: "EXPRESSED_INTENT", subtype: "solution_search" }, evidenceIds: [],
      jurisdiction: null, assessmentId: null, createdAt: "2026-10-05T12:00:00.000Z",
      updatedAt: "2026-10-05T12:00:00.000Z",
    },
    assessment: null,
  } as unknown as SelfProspectingPersistInput;
}

describe("self-prospecting persistence adapter", () => {
  it("derives each source provider from its provenance-linked run", async () => {
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name !== "intentlead_persist_self_prospecting_candidate" || !args) throw new Error("unexpected RPC");
      return { data: "10000000-0000-4000-8000-000000000007", error: null };
    });
    const persistence = createSupabaseSelfProspectingPersistence({ rpc } as unknown as JobDatabaseClient);

    await persistence.persistCandidate(job, input("10000000-0000-4000-8000-000000000003"));

    const args = rpc.mock.calls[0]?.[1];
    const slice = args?.p_slice as { sourceItems: Array<{ provider: string }> };
    expect(slice.sourceItems[0]?.provider).toBe("hackernews");
  });

  it("rejects source evidence without a linked provider run before RPC", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const persistence = createSupabaseSelfProspectingPersistence({ rpc } as unknown as JobDatabaseClient);

    await expect(persistence.persistCandidate(job, input(null))).rejects.toThrow("source item provider run is missing");
    expect(rpc).not.toHaveBeenCalled();
  });
});
