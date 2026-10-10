import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ProviderDescriptor,
  ProviderRunRecorder,
  ProviderRuntimeDependencies,
  ProviderSelectionRequest,
  ProviderResult,
} from "../../worker/providers/contracts";
import { executeProviderWithFallback } from "../../worker/providers/registry";
import { ProviderSelectionError } from "../../worker/providers/contracts";
import { consumeProviderReservation } from "../../worker/providers/registry-execution";

export const TEST_NOW = new Date("2026-10-05T12:00:00.000Z");

export function providerFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
}

export function providerDescriptor(
  id: ProviderDescriptor["id"],
  capability: ProviderDescriptor["capability"],
  overrides: Partial<ProviderDescriptor> = {},
): ProviderDescriptor {
  return {
    id,
    version: "fixture-v1",
    capability,
    priority: id === "reddit" || id === "exa" ? 10 : 20,
    marketProfiles: ["EN_DISCOVERY_ONLY"],
    languages: ["en"],
    regions: ["*"],
    jurisdictions: ["*"],
    legalStatus: "ALLOWED",
    operationalState: "fixture_only",
    stateObservedAt: TEST_NOW.toISOString(),
    stateReason: null,
    retryAfterMs: null,
    configuredCost: { amount: 0, currency: null },
    ...overrides,
  };
}

export function providerRequest(
  profile: ProviderSelectionRequest["profile"],
  descriptors: ProviderDescriptor[],
  overrides: Partial<ProviderSelectionRequest> = {},
): ProviderSelectionRequest {
  return {
    profile,
    capability: descriptors[0]?.capability ?? "SOURCE_SEARCH",
    language: "en",
    region: "US",
    jurisdiction: null,
    executionMode: "fixture",
    timeoutMs: 250,
    budget: { currency: "USD", remainingCost: 10, remainingProviderCalls: Math.max(1, descriptors.length) },
    allowFallback: false,
    descriptors,
    ...overrides,
  };
}

export async function runWithProviderReservation<T>(
  request: ProviderSelectionRequest,
  invoke: Parameters<typeof executeProviderWithFallback<T>>[1],
): Promise<ProviderResult<T>> {
  const result = await executeProviderWithFallback(request, invoke);
  if (result.ok) return result.outcome;
  if (result.lastOutcome) return result.lastOutcome;
  throw new ProviderSelectionError(result.error);
}

export function consumeFixtureReservation(
  descriptor: ProviderDescriptor,
  context: Parameters<typeof consumeProviderReservation>[2],
): void {
  consumeProviderReservation(context.reservation, descriptor, context);
}

export function makeRecorder() {
  const started: Parameters<ProviderRunRecorder["start"]>[0][] = [];
  const finished: Parameters<ProviderRunRecorder["finish"]>[0][] = [];
  const recorder: ProviderRunRecorder = {
    async start(input) {
      started.push(input);
    },
    async finish(input) {
      finished.push(input);
    },
  };
  return { recorder, started, finished };
}

export function makeDependencies(
  http: ProviderRuntimeDependencies["http"],
  overrides: Partial<ProviderRuntimeDependencies> = {},
) {
  const { recorder, started, finished } = makeRecorder();
  let id = 0;
  const dependencies: ProviderRuntimeDependencies = {
    http,
    now: () => new Date(TEST_NOW),
    sleep: async () => undefined,
    createId: () => `fixture-run-${++id}`,
    recorder,
    timeoutMs: 100,
    maxResponseBytes: 100_000,
    maxKeywords: 5,
    maxRecords: 100,
    maxContentChars: 2_000,
    ...overrides,
  };
  return { dependencies, started, finished };
}

export function fakeResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

export function abortedSignal(reason = new Error("cancelled")) {
  const controller = new AbortController();
  controller.abort(reason);
  return controller.signal;
}

export function waitForAbort(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
}
