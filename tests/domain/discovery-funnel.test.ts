import { describe, expect, it } from "vitest";
import { DiscoveryFunnelMetricsSchema } from "../../lib/domain/schemas/discovery-funnel";

const valid = {
  rawCandidates: 50,
  normalizedCandidates: 40,
  deduplicatedSignals: 30,
  processedSignals: 25,
  confirmedSignals: 20,
  uniqueCompanies: 12,
  opportunitiesReturned: 14,
  acceptedOpportunities: 7,
};

describe("discovery funnel metrics", () => {
  it("keeps provider, signal, company and Opportunity counts distinct", () => {
    expect(DiscoveryFunnelMetricsSchema.parse(valid)).toEqual(valid);
  });

  it.each([
    { ...valid, normalizedCandidates: 51 },
    { ...valid, deduplicatedSignals: 41 },
    { ...valid, processedSignals: 31 },
    { ...valid, confirmedSignals: 26 },
    { ...valid, uniqueCompanies: 21 },
    { ...valid, acceptedOpportunities: 15 },
  ])("rejects impossible count progression", value => {
    expect(DiscoveryFunnelMetricsSchema.safeParse(value).success).toBe(false);
  });
});
