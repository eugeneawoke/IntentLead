import { randomUUID } from "node:crypto";
import {
  ProviderCancelledError,
  type ProviderRunRecorder,
  type ProviderRuntimeDependencies,
} from "./contracts";

function writeProviderEvent(event: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

export function createStructuredProviderRunRecorder(): ProviderRunRecorder {
  return {
    async start(input) {
      writeProviderEvent({
        level: "info",
        event: "PROVIDER_RUN_STARTED",
        providerRunId: input.providerRunId,
        capability: input.capability,
        provider: input.provider,
        providerVersion: input.providerVersion,
        startedAt: input.startedAt,
        marketProfileId: input.requestMetadata.marketProfileId,
        traceId: input.requestMetadata.traceId,
        inputCount: input.requestMetadata.inputCount,
        inputHash: input.requestMetadata.inputHash,
      });
    },
    async finish(input) {
      writeProviderEvent({
        level: input.status === "SUCCEEDED" || input.status === "PARTIAL" ? "info" : "warn",
        event: "PROVIDER_RUN_FINISHED",
        providerRunId: input.providerRunId,
        status: input.status,
        finishedAt: input.finishedAt,
        latencyMs: input.latencyMs,
        usage: input.usage,
        cost: input.cost,
        responseMetadata: input.responseMetadata,
      });
    },
  };
}

function sleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.reject(new ProviderCancelledError());
  return new Promise((resolve, reject) => {
    const handle = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    const onAbort = () => {
      clearTimeout(handle);
      reject(new ProviderCancelledError());
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function createProviderRuntimeDependencies(
  recorder: ProviderRunRecorder = createStructuredProviderRunRecorder(),
  overrides: Partial<Pick<ProviderRuntimeDependencies,
    "timeoutMs" | "maxResponseBytes" | "maxRequestsPerRun" | "maxKeywords" | "maxRecords" | "maxContentChars">> = {},
): ProviderRuntimeDependencies {
  return {
    http: (url, init) => globalThis.fetch(url, { ...init, redirect: "error" }),
    now: () => new Date(),
    sleep,
    createId: () => randomUUID(),
    recorder,
    timeoutMs: overrides.timeoutMs ?? 8_000,
    maxResponseBytes: overrides.maxResponseBytes ?? 1_000_000,
    maxRequestsPerRun: overrides.maxRequestsPerRun ?? 10,
    maxKeywords: overrides.maxKeywords ?? 5,
    maxRecords: overrides.maxRecords ?? 100,
    maxContentChars: overrides.maxContentChars ?? 2_000,
  };
}
