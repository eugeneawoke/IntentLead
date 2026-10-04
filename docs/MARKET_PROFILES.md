# Market profiles

## Purpose

A MarketProfile selects language, provider capabilities, source availability, compliance rules, outreach channels and data policy without scattering country conditionals through code.

## Shape

```ts
type MarketProfile = {
  id: string;
  jurisdictions: string[];
  regions: string[];
  languages: string[];
  capabilities: Record<string, string[]>;
  disabledCapabilities: string[];
  legalPolicyId: string;
  retentionPolicyId: string;
  outreachPolicyId: string;
  defaultCurrency: string;
  timezone: string;
};
```

## Initial profiles

### EN_DISCOVERY_ONLY

English-language discovery profile. Reddit/HN and global web/entity providers may be used for research where permitted, but contact enrichment and outreach are disabled until a country/jurisdiction-specific legal, retention and outreach policy is selected. Language never substitutes for jurisdiction.

### CIS_RU

Russian-language regional profile. Candidate capabilities include Yandex search/business/maps, 2GIS, official websites and regional sources. Availability is `documented_only` until official API/terms verification. ChatGPT/Perplexity/Alice/GigaChat visibility observations are separate capabilities with separate measurement methods.

### LOCAL_CUSTOM

Parameterizes country, city/area, category, language, map/directory/review sources and owner/contact rules. A local profile requires an explicit category and geography; it cannot silently fall back to global SaaS sources.

## Resolution rules

- MarketProfile is chosen by an authorized workspace setting or DiscoveryBrief.
- Provider registry resolves only compatible capabilities.
- Missing capability returns a structured unavailable/degraded result, not a hidden fallback across jurisdictions.
- Legal, retention and outreach policies are part of resolution.
- Contact enrichment or outreach requires a country/jurisdiction scope; `EN_DISCOVERY_ONLY` cannot authorize it.
- New market activation requires quality sample, cost envelope and compliance review.
