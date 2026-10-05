import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import {
  createExaCompanyResolutionProvider,
  createSerperCompanyResolutionProvider,
} from "../../worker/providers/company-resolution";
import { createHackerNewsAdapter } from "../../worker/providers/hackernews";
import { createRedditAdapter } from "../../worker/providers/reddit";
import type {
  CompanyCandidate,
  CompanyInference,
  CompanyResolutionProvider,
  DiscoveredSignal,
  ProviderCallContext,
  ProviderResult,
  SignalSourceAdapter,
} from "../../worker/providers/contracts";
import {
  abortedSignal,
  fakeResponse,
  makeDependencies,
  providerDescriptor,
  waitForAbort,
} from "./helpers";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});
const context = (signal: AbortSignal = new AbortController().signal): ProviderCallContext => ({
  profile,
  traceId: "fixture-trace",
  signal,
});

type ProviderKey = "reddit" | "hackernews" | "exa" | "serper";
type ProviderValue<K extends ProviderKey> = K extends "reddit" | "hackernews" ? DiscoveredSignal[] : CompanyCandidate[];
type FixtureAdapters = { source?: SignalSourceAdapter; company?: CompanyResolutionProvider };

function buildAdapter(
  key: ProviderKey,
  http: Parameters<typeof makeDependencies>[0],
  options: { inferenceOutput?: unknown; inference?: CompanyInference; timeoutMs?: number } = {},
): { adapter: FixtureAdapters; calls: string[]; started: unknown[]; finished: unknown[] } {
  const calls: string[] = [];
  const wrappedHttp = async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(String(input));
    return http(String(input), init);
  };
  const { dependencies, started, finished } = makeDependencies(wrappedHttp, { timeoutMs: options.timeoutMs ?? 100 });
  const capability = key === "reddit" || key === "hackernews" ? "SOURCE_SEARCH" : "COMPANY_RESOLUTION";
  const descriptor = providerDescriptor(key, capability);
  const inference: CompanyInference = options.inference ?? {
      async infer(input) {
      if (options.inferenceOutput !== undefined) return options.inferenceOutput;
      const request = JSON.parse(input.messages[1].content) as { evidence: Array<{ providerSourceId: string }> };
      return {
        candidates: [{
          companyName: "Acme Example",
          companyDomain: "https://www.acme.test/company/page",
          confidence: 0.91,
          evidenceSourceIds: [request.evidence[0].providerSourceId],
        }],
      };
    },
  };

  if (key === "reddit") {
    return {
      adapter: { source: createRedditAdapter({ clientId: "fixture-client", clientSecret: "fixture-secret", descriptor, dependencies }) },
      calls,
      started,
      finished,
    };
  }
  if (key === "hackernews") {
    return { adapter: { source: createHackerNewsAdapter({ descriptor, dependencies }) }, calls, started, finished };
  }
  const config = { apiKey: "fixture-key", descriptor, dependencies, inference };
  return {
    adapter: { company: key === "exa" ? createExaCompanyResolutionProvider(config) : createSerperCompanyResolutionProvider(config) },
    calls,
    started,
    finished,
  };
}

async function runAdapter<K extends ProviderKey>(
  key: K,
  adapter: FixtureAdapters,
  signal = new AbortController().signal,
): Promise<ProviderResult<ProviderValue<K>>> {
  const callContext = context(signal);
  const result = adapter.source
    ? await adapter.source.search({ keywords: ["fictional operations"] }, callContext)
    : await adapter.company!.resolve({ signalContent: "Fictional Acme Example public workflow issue" }, callContext);
  return result as ProviderResult<ProviderValue<K>>;
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("source adapters", () => {
  it("normalizes Reddit content and deduplicates by stable source identity", async () => {
    const built = buildAdapter("reddit", async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse(fixture("reddit-success.json")));
    const result = await runAdapter("reddit", built.adapter);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0]).toMatchObject({
      source: "reddit",
      externalId: "fixture-reddit-001",
      sourceUrl: "https://acme.test/operations",
      context: "fixture",
    });
    expect(result.value?.[0].content).toContain("customer intake");
    expect(result.value?.[0].content).toContain("[email redacted]");
    expect(result.value?.[0].content).not.toMatch(/<|must_not_escape|&amp;/);
    expect(result.value?.[0]).not.toHaveProperty("authorHandle");
    expect(JSON.stringify(result)).not.toContain("fixture.person@example.test");
    expect(result.provenance[0]).toMatchObject({
      providerId: "reddit",
      providerSourceId: "fixture-reddit-001",
      providerRunId: result.providerRunId,
      schemaVersion: 1,
    });
    expect(JSON.stringify(result)).not.toContain('"kind"');
    expect(built.calls).toHaveLength(2);
    expect(built.finished).toHaveLength(1);
  });

  it("normalizes HN timestamps, URLs and HTML while deduplicating", async () => {
    const built = buildAdapter("hackernews", async () => fakeResponse(fixture("hackernews-success.json")));
    const result = await runAdapter("hackernews", built.adapter);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0]).toMatchObject({
      source: "hackernews",
      externalId: "fixture-hn-001",
      sourceUrl: "https://acme.test/notes",
      publishedAt: "2026-10-05T10:00:00.000Z",
    });
    expect(result.value?.[0].content).toContain("wants options");
    expect(result.value?.[0].content).toContain("[email redacted]");
    expect(result.value?.[0].content).not.toMatch(/<|&amp;/);
    expect(result.value?.[0]).not.toHaveProperty("authorHandle");
    expect(JSON.stringify(result)).not.toContain("fixture.person@example.test");
    expect(JSON.stringify(result)).not.toContain('"objectID"');
  });
});

describe("provider boundary outcomes", () => {
  const keys: ProviderKey[] = ["reddit", "hackernews", "exa", "serper"];

  it.each(keys)("returns a successful empty result for %s without inference", async (key) => {
    const empty = key === "reddit" ? { data: { children: [] } }
      : key === "hackernews" ? { hits: [] }
        : key === "exa" ? { results: [] } : { organic: [] };
    const built = buildAdapter(key, async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse(empty));

    const result = await runAdapter(key, built.adapter);

    expect(result.status).toBe("EMPTY");
    expect(result.value).toEqual([]);
    expect(result.capabilityError).toBeNull();
  });

  it.each(keys)("distinguishes malformed provider shape for %s", async (key) => {
    const malformed = key === "reddit" ? { data: { children: "drift" } }
      : key === "hackernews" ? { hits: null }
        : key === "exa" ? { results: "drift" } : { organic: {} };
    const built = buildAdapter(key, async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse(malformed));
    const result = await runAdapter(key, built.adapter);

    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("MALFORMED_RESPONSE");
    expect(result.capabilityError?.code).toBe("INTERNAL_ERROR");
    expect(result.value).toBeNull();
  });

  it.each([401, 403])("maps HTTP %i to non-retryable authorization for every provider", async (status) => {
    for (const key of keys) {
      const built = buildAdapter(key, async (input) => String(input).includes("access_token")
        ? fakeResponse({ access_token: "fixture-bearer" })
        : fakeResponse({ error: "fixture" }, status));
      const result = await runAdapter(key, built.adapter);
      expect(result.status).toBe("FAILED");
      expect(result.failureKind).toBe("UNAUTHORIZED");
      expect(result.capabilityError).toMatchObject({ code: "FORBIDDEN", retryable: false });
    }
  });

  it.each(keys)("bounds 429 retry metadata for %s", async (key) => {
    const built = buildAdapter(key, async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse({ error: "fixture" }, 429, { "retry-after": "900" }));
    const result = await runAdapter(key, built.adapter);

    expect(result.status).toBe("RATE_LIMITED");
    expect(result.failureKind).toBe("RATE_LIMITED");
    expect(result.capabilityError).toMatchObject({ code: "RATE_LIMITED", retryable: true, retryAfterMs: 60_000 });
  });

  it.each(keys)("maps provider 5xx to unavailable for %s", async (key) => {
    const built = buildAdapter(key, async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse({ error: "fixture" }, 503));
    const result = await runAdapter(key, built.adapter);

    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("UNAVAILABLE");
    expect(result.capabilityError).toMatchObject({ code: "DEPENDENCY_UNAVAILABLE", retryable: true });
  });

  it.each(keys)("times out and aborts in-flight HTTP work for %s", async (key) => {
    const built = buildAdapter(key, async (input, init) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : waitForAbort(init?.signal as AbortSignal), { timeoutMs: 5 });
    const result = await runAdapter(key, built.adapter);
    expect(result.status).toBe("TIMEOUT");
    expect(result.capabilityError?.code).toBe("TIMEOUT");
  });

  it.each(keys)("propagates caller cancellation during HTTP for %s", async (key) => {
    const controller = new AbortController();
    const built = buildAdapter(key, async (input, init) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : waitForAbort(init?.signal as AbortSignal), { timeoutMs: 100 });
    const running = runAdapter(key, built.adapter, controller.signal);
    setTimeout(() => controller.abort(new Error("fixture cancellation")), 5);

    await expect(running).rejects.toMatchObject({ kind: "CANCELLED" });
    expect(built.finished).toHaveLength(1);
  });

  it.each(keys)("does not start HTTP when %s receives an already-aborted signal", async (key) => {
    let requests = 0;
    const built = buildAdapter(key, async () => { requests++; return fakeResponse({}); });
    await expect(runAdapter(key, built.adapter, abortedSignal())).rejects.toMatchObject({ kind: "CANCELLED" });
    expect(requests).toBe(0);
    expect(built.started).toHaveLength(0);
  });

  it.each(keys)("records terminal provider-run failures without payloads for %s", async (key) => {
    const built = buildAdapter(key, async (input) => String(input).includes("access_token")
      ? fakeResponse({ access_token: "fixture-bearer" })
      : fakeResponse({ error: "do-not-store-this-body" }, 503));
    const result = await runAdapter(key, built.adapter);

    expect(built.started).toHaveLength(1);
    expect(built.finished).toHaveLength(1);
    expect(JSON.stringify(built.finished)).not.toContain("do-not-store-this-body");
    expect(result.providerRunId).toBe("fixture-run-1");
  });
});
