import { afterEach, describe, expect, it, vi } from "vitest";
import type { LeasedJob } from "../../worker/jobs/repository";
import { createConfiguredSelfProspectingHandler, installFixtureNetworkGuard } from "../../worker/runtime";
import { fixtureBrief, fixtureIcp, fixtureIds, fixtureOffer, fixtureProfile } from "../evals/opportunity-fixtures";

const now = new Date("2026-10-06T08:00:00.000Z");
const job: LeasedJob = {
  schemaVersion: 1, id: fixtureIds.job, workspaceId: fixtureIds.workspace, capability: "SOURCE_SEARCH",
  marketProfileId: "EN_DISCOVERY_ONLY", discoveryBriefId: fixtureIds.brief,
  idempotencyKey: "fixture-production-authority", traceId: fixtureIds.job,
  attempt: 1, maxAttempts: 3, createdAt: now.toISOString(), updatedAt: now.toISOString(), state: "LEASED",
  lease: { owner: "fixture-worker", token: "00000000-0000-4000-8000-000000000712", expiresAt: "2026-10-06T08:01:00.000Z" },
};

function databaseClient() {
  return { rpc: vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (name === "intentlead_get_self_prospecting_context") {
      return { data: { profile: fixtureProfile, brief: fixtureBrief, offer: fixtureOffer, icp: fixtureIcp }, error: null };
    }
    if (name === "intentlead_get_self_prospecting_candidate") return { data: null, error: null };
    if (name === "intentlead_persist_self_prospecting_candidate") {
      const slice = args.p_slice as { opportunity: { id: string } };
      return { data: slice.opportunity.id, error: null };
    }
    throw new Error(`unexpected RPC: ${name}`);
  }) };
}

function execution() {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    async checkpoint() {},
    async runExternalOperation<TProvider, TResult>(
      _capability: string, select: () => TProvider,
      operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>,
    ) { return operation(select(), controller.signal); },
  };
}

describe("fixture network authority", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("allows only the configured database origin and blocks provider/network origins", async () => {
    const underlying = vi.fn(async () => new Response("ok"));
    const restore = installFixtureNetworkGuard({
      mode: "fixture", supabaseUrl: "https://db.intentlead.test", fetchImplementation: underlying,
    });

    await expect(fetch("https://db.intentlead.test/rest/v1/jobs", { redirect: "follow" })).resolves.toBeInstanceOf(Response);
    await expect(fetch("https://api.openai.com/v1/responses")).rejects.toThrow("blocked network origin");
    await expect(fetch("https://www.reddit.com/search.json")).rejects.toThrow("blocked network origin");
    expect(underlying).toHaveBeenCalledTimes(1);
    expect(underlying).toHaveBeenCalledWith(
      "https://db.intentlead.test/rest/v1/jobs", expect.objectContaining({ redirect: "error" }),
    );
    restore();
  });

  it("applies the same network deny guard to recorded evidence mode", async () => {
    const underlying = vi.fn(async () => new Response("ok"));
    const restore = installFixtureNetworkGuard({
      mode: "recorded", supabaseUrl: "https://db.intentlead.test", fetchImplementation: underlying,
    });
    await expect(fetch("https://api.openai.com/v1/responses")).rejects.toThrow("blocked network origin");
    expect(underlying).not.toHaveBeenCalled();
    restore();
  });

  it("requires guard-issued authority and completes the durable fixture workflow in production mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const withoutAuthority = createConfiguredSelfProspectingHandler({ mode: "fixture", client: databaseClient() });
    await expect(withoutAuthority!(job, execution())).rejects.toMatchObject({ code: "POLICY_DENIED" });

    const underlying = vi.fn(async () => new Response("ok"));
    const restore = installFixtureNetworkGuard({
      mode: "fixture", supabaseUrl: "https://db.intentlead.test", fetchImplementation: underlying,
    });
    const handler = createConfiguredSelfProspectingHandler({
      mode: "fixture", client: databaseClient(), noNetworkAuthority: restore.authority ?? undefined,
    });
    const result = await handler!(job, execution());

    expect(result).toMatchObject({ state: "COMPLETED", result: { outcome: "REVIEW_READY" } });
    expect(underlying).not.toHaveBeenCalled();
    const revokedAuthority = restore.authority;
    restore();
    const revokedHandler = createConfiguredSelfProspectingHandler({
      mode: "fixture", client: databaseClient(), noNetworkAuthority: revokedAuthority ?? undefined,
    });
    await expect(revokedHandler!(job, execution())).rejects.toMatchObject({ code: "POLICY_DENIED" });
  });
});
