import type { SourceMarketProfileId } from "../../types/source-plan";

export interface MarketProfileFoundation {
  id: SourceMarketProfileId;
  languages: readonly string[];
  countryCodes: readonly string[];
  localScopeRequired: boolean;
  sourceEmphasis: readonly string[];
}

function profile(value: MarketProfileFoundation): MarketProfileFoundation {
  return Object.freeze({
    ...value,
    languages: Object.freeze([...value.languages]),
    countryCodes: Object.freeze([...value.countryCodes]),
    sourceEmphasis: Object.freeze([...value.sourceEmphasis]),
  });
}

/** Planning foundations only. Runtime activation remains a separate policy and persistence gate. */
export const MARKET_PROFILE_FOUNDATIONS: readonly MarketProfileFoundation[] = Object.freeze([
  profile({
    id: "EN_DISCOVERY_ONLY", languages: ["en"], countryCodes: [], localScopeRequired: false,
    sourceEmphasis: ["COMMUNITY", "DEVELOPER", "PUBLIC_WEB", "OFFICIAL_SITE", "JOBS", "NEWS"],
  }),
  profile({
    id: "GLOBAL_EN", languages: ["en"], countryCodes: [], localScopeRequired: false,
    sourceEmphasis: ["PUBLIC_WEB", "COMMUNITY", "DEVELOPER", "JOBS", "REVIEWS", "NEWS", "OFFICIAL_SITE"],
  }),
  profile({
    id: "CIS", languages: ["ru"], countryCodes: ["AM", "AZ", "BY", "KZ", "KG", "MD", "RU", "TJ", "UZ"],
    localScopeRequired: false, sourceEmphasis: ["PUBLIC_WEB", "COMMUNITY", "DIRECTORIES", "JOBS", "NEWS"],
  }),
  profile({
    id: "CIS_RU", languages: ["ru"], countryCodes: ["BY", "KZ", "RU"], localScopeRequired: false,
    sourceEmphasis: ["PUBLIC_WEB", "COMMUNITY", "DIRECTORIES", "JOBS", "NEWS"],
  }),
  profile({
    id: "RU", languages: ["ru"], countryCodes: ["RU"], localScopeRequired: false,
    sourceEmphasis: ["PUBLIC_WEB", "COMMUNITY", "MAPS", "DIRECTORIES", "JOBS", "REVIEWS", "NEWS"],
  }),
  profile({
    id: "BY", languages: ["ru", "be"], countryCodes: ["BY"], localScopeRequired: false,
    sourceEmphasis: ["PUBLIC_WEB", "DIRECTORIES", "JOBS", "NEWS", "OFFICIAL_SITE"],
  }),
  profile({
    id: "KZ", languages: ["ru", "kk"], countryCodes: ["KZ"], localScopeRequired: false,
    sourceEmphasis: ["PUBLIC_WEB", "MAPS", "DIRECTORIES", "JOBS", "NEWS", "OFFICIAL_SITE"],
  }),
  profile({
    id: "LOCAL_CUSTOM", languages: ["*"], countryCodes: [], localScopeRequired: true,
    sourceEmphasis: ["MAPS", "DIRECTORIES", "REVIEWS", "OFFICIAL_SITE", "NEWS"],
  }),
]);

export function marketProfileFoundation(id: SourceMarketProfileId): MarketProfileFoundation {
  const value = MARKET_PROFILE_FOUNDATIONS.find(candidate => candidate.id === id);
  if (!value) throw new Error(`Unknown source-planning market profile: ${id}`);
  return value;
}
