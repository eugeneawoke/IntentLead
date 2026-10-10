import type { JobHandler } from "./jobs/worker";
import { createSelfProspectingHandler } from "./workflows/self-prospecting";
import {
  createFixtureSelfProspectingDependencies, createNoNetworkSelfProspectingDependencies,
  type FixtureRuntimeDatabaseClient,
} from "./workflows/fixture-runtime";
import { loadRecordedEvidence } from "./workflows/recorded-evidence";
import {
  installNoNetworkExecutionGuard, type NoNetworkExecutionAuthority, type NoNetworkExecutionGuard,
} from "./providers/no-network-authority";

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
  noNetworkAuthority?: NoNetworkExecutionAuthority;
}): JobHandler | undefined {
  if (input.mode === "disabled") return undefined;
  let dependencies;
  if (input.mode === "fixture") {
    dependencies = createFixtureSelfProspectingDependencies(input.client, undefined, input.noNetworkAuthority);
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

export type FixtureNetworkGuard = NoNetworkExecutionGuard;

export function installFixtureNetworkGuard(input: {
  mode: SelfProspectingMode;
  supabaseUrl: string;
  fetchImplementation?: typeof fetch;
}): FixtureNetworkGuard {
  return installNoNetworkExecutionGuard({
    enabled: input.mode !== "disabled",
    allowedOrigin: new URL(input.supabaseUrl).origin,
    fetchImplementation: input.fetchImplementation,
  });
}
