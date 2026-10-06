import type { JobHandler } from "./jobs/worker";
import { createSelfProspectingHandler } from "./workflows/self-prospecting";
import {
  createFixtureSelfProspectingDependencies, createNoNetworkSelfProspectingDependencies,
  type FixtureRuntimeDatabaseClient,
} from "./workflows/fixture-runtime";
import { loadRecordedEvidence } from "./workflows/recorded-evidence";

export type SelfProspectingMode = "disabled" | "fixture" | "recorded";

export function resolveSelfProspectingMode(value: string | undefined): SelfProspectingMode {
  const mode = value?.trim() || "disabled";
  if (mode === "disabled" || mode === "fixture" || mode === "recorded") return mode;
  throw new Error("Invalid worker configuration: SELF_PROSPECTING_MODE");
}

export function createConfiguredSelfProspectingHandler(input: {
  mode: SelfProspectingMode;
  client: FixtureRuntimeDatabaseClient;
  recordedEvidencePath?: string;
}): JobHandler | undefined {
  if (input.mode === "disabled") return undefined;
  let dependencies;
  if (input.mode === "fixture") {
    dependencies = createFixtureSelfProspectingDependencies(input.client);
  } else {
    const recorded = loadRecordedEvidence(input.recordedEvidencePath);
    dependencies = createNoNetworkSelfProspectingDependencies(input.client, recorded.fixture, [
      "RECORDED_AUTHORIZED_EVIDENCE", `RECORDED_AUTHORIZED_AT:${recorded.authorization.authorizedAt}`,
      `RECORDED_AUTHORIZATION_REFERENCE:${recorded.authorization.reference}`,
      "NO_NETWORK", "NOT_LIVE_PROVIDER_EVIDENCE",
    ]);
  }
  return createSelfProspectingHandler(dependencies);
}

export function installFixtureNetworkGuard(input: {
  mode: SelfProspectingMode;
  supabaseUrl: string;
  fetchImplementation?: typeof fetch;
}): () => void {
  if (input.mode === "disabled") return () => undefined;
  const allowedOrigin = new URL(input.supabaseUrl).origin;
  const original = input.fetchImplementation ?? globalThis.fetch;
  if (typeof original !== "function") throw new Error("Global fetch is unavailable for the no-network guard");
  const guarded: typeof fetch = async (request, init) => {
    const url = new URL(typeof request === "string" || request instanceof URL ? request : request.url);
    if (url.origin !== allowedOrigin) throw new Error(`No-network mode blocked network origin: ${url.origin}`);
    return original(request, { ...init, redirect: "error" });
  };
  globalThis.fetch = guarded;
  return () => { globalThis.fetch = original; };
}
