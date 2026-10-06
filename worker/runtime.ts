import type { JobHandler } from "./jobs/worker";
import { createSelfProspectingHandler } from "./workflows/self-prospecting";
import {
  createFixtureSelfProspectingDependencies, type FixtureRuntimeDatabaseClient,
} from "./workflows/fixture-runtime";

export type SelfProspectingMode = "disabled" | "fixture";

export function resolveSelfProspectingMode(value: string | undefined): SelfProspectingMode {
  const mode = value?.trim() || "disabled";
  if (mode === "disabled" || mode === "fixture") return mode;
  throw new Error("Invalid worker configuration: SELF_PROSPECTING_MODE");
}

export function createConfiguredSelfProspectingHandler(input: {
  mode: SelfProspectingMode;
  client: FixtureRuntimeDatabaseClient;
}): JobHandler | undefined {
  if (input.mode === "disabled") return undefined;
  return createSelfProspectingHandler(createFixtureSelfProspectingDependencies(input.client));
}

export function installFixtureNetworkGuard(input: {
  mode: SelfProspectingMode;
  supabaseUrl: string;
  fetchImplementation?: typeof fetch;
}): () => void {
  if (input.mode !== "fixture") return () => undefined;
  const allowedOrigin = new URL(input.supabaseUrl).origin;
  const original = input.fetchImplementation ?? globalThis.fetch;
  if (typeof original !== "function") throw new Error("Global fetch is unavailable for the fixture network guard");
  const guarded: typeof fetch = async (request, init) => {
    const url = new URL(typeof request === "string" || request instanceof URL ? request : request.url);
    if (url.origin !== allowedOrigin) throw new Error(`Fixture mode blocked network origin: ${url.origin}`);
    return original(request, { ...init, redirect: "error" });
  };
  globalThis.fetch = guarded;
  return () => { globalThis.fetch = original; };
}
