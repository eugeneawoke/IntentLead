import { describe, expect, it } from "vitest";
import { PROVIDER_CATALOG } from "../../worker/providers/catalog";
import { selectProvider } from "../../worker/providers/registry";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "PERSON_SEARCH", "EMAIL_FIND", "EMAIL_VERIFY"],
});

describe("provider catalog", () => {
  it("represents free foundations and demand-gated paid fallbacks without transmission capabilities", () => {
    expect(PROVIDER_CATALOG.map(item => item.id)).toEqual(expect.arrayContaining([
      "hackernews", "reddit", "github", "stackexchange", "official_company_site",
      "greenhouse", "lever", "ashby", "exa", "serper", "prospeo", "hunter", "apollo", "openai",
    ]));
    expect(PROVIDER_CATALOG.filter(item => ["exa", "serper", "prospeo", "hunter", "apollo", "openai"].includes(item.id))
      .every(item => item.operationalState === "paid_locked")).toBe(true);
    expect(PROVIDER_CATALOG.some(item => item.capability.includes("SEND") || item.capability.includes("MAILBOX"))).toBe(false);
    expect(Object.isFrozen(PROVIDER_CATALOG[0]?.marketProfiles)).toBe(true);
    expect(Object.isFrozen(PROVIDER_CATALOG[0]?.configuredCost)).toBe(true);
  });

  it("cannot select a paid-locked provider even with a positive budget", () => {
    const descriptors = PROVIDER_CATALOG.filter(item => item.id === "prospeo" && item.capability === "EMAIL_FIND");
    expect(() => selectProvider({
      profile,
      capability: "EMAIL_FIND",
      language: "en",
      region: "US",
      jurisdiction: null,
      executionMode: "live",
      timeoutMs: 250,
      budget: { currency: "USD", remainingCost: 100, remainingProviderCalls: 10 },
      descriptors: [...descriptors],
      allowFallback: true,
    })).toThrowError(expect.objectContaining({ capabilityError: expect.objectContaining({ code: "CAPABILITY_UNAVAILABLE" }) }));
  });
});
