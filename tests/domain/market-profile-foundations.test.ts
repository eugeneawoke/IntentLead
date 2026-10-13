import { describe, expect, it } from "vitest";
import {
  MARKET_PROFILE_FOUNDATIONS, marketProfileFoundation,
} from "../../lib/domain/market-profile-foundations";

describe("source-planning market profile foundations", () => {
  it("represents global, regional, country, and local profiles without country branches", () => {
    expect(MARKET_PROFILE_FOUNDATIONS.map(profile => profile.id)).toEqual(expect.arrayContaining([
      "EN_DISCOVERY_ONLY", "GLOBAL_EN", "CIS", "RU", "BY", "KZ", "LOCAL_CUSTOM",
    ]));
    expect(marketProfileFoundation("BY")).toMatchObject({ languages: ["ru", "be"], countryCodes: ["BY"] });
    expect(marketProfileFoundation("KZ")).toMatchObject({ languages: ["ru", "kk"], countryCodes: ["KZ"] });
    expect(marketProfileFoundation("LOCAL_CUSTOM").localScopeRequired).toBe(true);
  });

  it("freezes nested declarations so selection inputs cannot drift at runtime", () => {
    const profile = marketProfileFoundation("GLOBAL_EN");
    expect(Object.isFrozen(MARKET_PROFILE_FOUNDATIONS)).toBe(true);
    expect(Object.isFrozen(profile.languages)).toBe(true);
    expect(Object.isFrozen(profile.countryCodes)).toBe(true);
    expect(Object.isFrozen(profile.sourceEmphasis)).toBe(true);
  });
});
