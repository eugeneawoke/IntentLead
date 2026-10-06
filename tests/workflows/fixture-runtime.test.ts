import { afterEach, describe, expect, it, vi } from "vitest";
import { createSelfProspectingHandler } from "../../worker/workflows/self-prospecting";
import { createFixtureSelfProspectingDependencies } from "../../worker/workflows/fixture-runtime";
import {
  createConfiguredSelfProspectingHandler, installFixtureNetworkGuard, resolveSelfProspectingMode,
} from "../../worker/runtime";
import { fixtureBrief, fixtureIcp, fixtureIds, fixtureOffer, fixtureProfile } from "../evals/opportunity-fixtures";
import type { LeasedJob } from "../../worker/jobs/repository";

const now = new Date("2026-10-06T08:00:00.000Z");
const job: LeasedJob = {
  schemaVersion: 1,
  id: fixtureIds.job,
  workspaceId: fixtureIds.workspace,
  capability: "SOURCE_SEARCH",
  marketProfileId: "EN_DISCOVERY_ONLY",
  discoveryBriefId: fixtureIds.brief,
  idempotencyKey: "fixture-runtime-test",
  traceId: fixtureIds.job,
  attempt: 1,
  maxAttempts: 3,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  state: "LEASED",
  lease: {
    owner: "fixture-worker",
    token: "00000000-0000-4000-8000-000000000712",
    expiresAt: "2026-10-06T08:01:00.000Z",
  },
};

function contextResult() {
  return { data: { profile: fixtureProfile, brief: fixtureBrief, offer: fixtureOffer, icp: fixtureIcp }, error: null };
}

function execution() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    async checkpoint() {},
    async runExternalOperation<TProvider, TResult>(
      _capability: string,
      select: () => TProvider,
      operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>,
    ) {
      return operation(select(), controller.signal);
    },
  };
}

describe("fixture self-prospecting runtime", () => {
  it("wires only an explicit fixture mode and rejects unknown modes", () => {
    expect(resolveSelfProspectingMode(undefined)).toBe("disabled");
    expect(resolveSelfProspectingMode("fixture")).toBe("fixture");
    expect(() => resolveSelfProspectingMode("live")).toThrow("SELF_PROSPECTING_MODE");
    expect(createConfiguredSelfProspectingHandler({
      mode: "disabled",
      client: { rpc: vi.fn() },
    })).toBeUndefined();
  });

  it("runs the synthetic contract fixture to a reviewable zero-cost Opportunity and reuses it on rerun", async () => {
    const persisted = new Map<string, { opportunityId: string; state: string }>();
    const slices: Array<Record<string, unknown>> = [];
    const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "intentlead_get_self_prospecting_context") return contextResult();
      if (name === "intentlead_get_self_prospecting_candidate") {
        return { data: persisted.get(String(args.p_candidate_key)) ?? null, error: null };
      }
      if (name === "intentlead_persist_self_prospecting_candidate") {
        const slice = args.p_slice as Record<string, unknown>;
        const opportunity = slice.opportunity as { id: string; state: string };
        slices.push(slice);
        persisted.set(String(args.p_candidate_key), { opportunityId: opportunity.id, state: opportunity.state });
        return { data: opportunity.id, error: null };
      }
      throw new Error(`unexpected RPC: ${name}`);
    });
    const handler = createSelfProspectingHandler(createFixtureSelfProspectingDependencies({ rpc }, () => now));

    const first = await handler(job, execution());
    const second = await handler(job, execution());

    expect(first).toMatchObject({ state: "COMPLETED", result: { outcome: "REVIEW_READY" } });
    expect(second).toMatchObject({ state: "COMPLETED", result: { outcome: "REVIEW_READY" } });
    expect(slices).toHaveLength(1);
    const slice = slices[0]!;
    expect(slice.opportunity).toMatchObject({ state: "HUMAN_REVIEW", signal: { family: "EXPRESSED_INTENT" } });
    expect(slice).toMatchObject({
      modelDecision: "REVIEW",
      assessment: { icpFit: 0.4, reviewReasons: expect.arrayContaining(["MODEL_REVIEW", "LOW_ICP_FIT", "NEEDS_HUMAN_CONFIRMATION"]) },
    });
    expect(slice.providerRuns).toEqual(expect.arrayContaining([
      expect.objectContaining({ capability: "SOURCE_SEARCH", requestCount: 0, actualCost: 0 }),
      expect.objectContaining({ capability: "COMPANY_RESOLUTION", requestCount: 0, actualCost: 0 }),
      expect.objectContaining({ capability: "OPPORTUNITY_ASSESSMENT", requestCount: 0, actualCost: 0 }),
    ]));
    const serialized = JSON.stringify({ first, slice }).toLowerCase();
    expect(serialized).not.toMatch(/email|phone|contact|message|draft|outreach|mailbox|send/);
  });

  it("uses different persisted identities for different jobs while keeping same-job replay stable", async () => {
    const run = async (leasedJob: LeasedJob) => {
      const slices: Array<Record<string, unknown>> = [];
      const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
        if (name === "intentlead_get_self_prospecting_context") return contextResult();
        if (name === "intentlead_get_self_prospecting_candidate") return { data: null, error: null };
        if (name === "intentlead_persist_self_prospecting_candidate") {
          const slice = args.p_slice as Record<string, unknown>;
          slices.push(slice);
          return { data: (slice.opportunity as { id: string }).id, error: null };
        }
        throw new Error(`unexpected RPC: ${name}`);
      });
      const handler = createSelfProspectingHandler(createFixtureSelfProspectingDependencies({ rpc }, () => now));
      await handler(leasedJob, execution());
      return slices[0]!;
    };
    const otherJob: LeasedJob = {
      ...job,
      id: "00000000-0000-4000-8000-000000000799",
      traceId: "00000000-0000-4000-8000-000000000799",
      idempotencyKey: "fixture-runtime-other-job",
      lease: { ...job.lease, token: "00000000-0000-4000-8000-000000000798" },
    };
    const first = await run(job);
    const second = await run(otherJob);
    const ids = (slice: Record<string, unknown>) => ({
      providerRuns: (slice.providerRuns as Array<{ id: string }>).map(item => item.id),
      sources: (slice.sourceItems as Array<{ id: string }>).map(item => item.id),
      evidence: (slice.evidenceItems as Array<{ id: string }>).map(item => item.id),
      company: (slice.company as { id: string }).id,
      opportunity: (slice.opportunity as { id: string }).id,
      assessment: (slice.assessment as { id: string }).id,
    });

    expect(ids(first)).not.toEqual(ids(second));
    expect(new Set([...ids(first).providerRuns, ...ids(second).providerRuns]).size).toBe(6);
  });

  it("fails closed when the lease-bound context is unavailable", async () => {
    const dependencies = createFixtureSelfProspectingDependencies({
      rpc: vi.fn(async () => ({ data: null, error: null })),
    }, () => now);
    await expect(dependencies.loadContext(job)).rejects.toThrow("returned no row");
  });
});

describe("fixture network guard", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it("allows only the configured database origin and blocks provider/network origins", async () => {
    const underlying = vi.fn(async () => new Response("ok"));
    const restore = installFixtureNetworkGuard({
      mode: "fixture",
      supabaseUrl: "https://db.intentlead.test",
      fetchImplementation: underlying,
    });

    await expect(fetch("https://db.intentlead.test/rest/v1/jobs", { redirect: "follow" })).resolves.toBeInstanceOf(Response);
    await expect(fetch("https://api.openai.com/v1/responses")).rejects.toThrow("blocked network origin");
    await expect(fetch("https://www.reddit.com/search.json")).rejects.toThrow("blocked network origin");
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(underlying).toHaveBeenCalledWith(
      "https://db.intentlead.test/rest/v1/jobs",
      expect.objectContaining({ redirect: "error" }),
    );
    restore();
  });
});
