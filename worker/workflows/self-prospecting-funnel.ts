import { DiscoveryFunnelMetricsSchema } from "../../lib/domain/schemas/discovery-funnel";
import type { DiscoveryFunnelMetrics } from "../../types/discovery-funnel";
import type { ProviderRunEnvelope } from "../providers/contracts";

export function sourceRunMetrics(runs: ProviderRunEnvelope<unknown>[]): {
  envelopes: ProviderRunEnvelope<unknown>[];
  rawCandidates: number;
  normalizedCandidates: number;
} {
  const envelopes = [...new Map(runs.map(run => [run.providerRunId, run])).values()];
  return {
    envelopes,
    rawCandidates: envelopes.reduce((total, run) => total + (run.usage.rawRecordCount ?? run.usage.recordCount), 0),
    normalizedCandidates: envelopes.reduce((total, run) => total + (run.usage.normalizedRecordCount ?? run.usage.recordCount), 0),
  };
}

export function buildDiscoveryFunnel(input: DiscoveryFunnelMetrics): DiscoveryFunnelMetrics {
  return DiscoveryFunnelMetricsSchema.parse(input);
}
