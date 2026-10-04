# Provider and source matrix

Statuses are architectural planning states, not proof of production readiness. Current pricing, terms and commercial rights must be verified from primary sources before activation.

| Provider/source | Capability | Market | Access method | Current | Priority | Required gate |
|---|---|---|---|---|---|---|
| Reddit | public post search | global | official API | implemented | P1 | credentials, terms, fixture/live smoke |
| Hacker News Algolia | public post search | global tech | public API | implemented | P1 | freshness/quality measurement |
| Exa | company/entity search | global | official API | implemented adapter-like code | P1 | contract, cost, confidence evidence |
| Serper | web search fallback | global | partner API | implemented fallback | P1 | terms/cost/health |
| Prospeo | email find/verify | supported markets | official API | implemented | P1 | split find vs verify semantics |
| Hunter | email find/verify | supported markets | official API | implemented | P1 | status mapping and fallback tests |
| Apollo | people/email enrichment | supported markets | official API | implemented | P1 | verify licensing and risky-email policy |
| OpenAI | bounded reasoning/embeddings | global where available | official API | implemented | P1 | typed output/eval/cost limits |
| Glook | site context/readiness | existing ecosystem | current direct DB; target signed API/event | partial/unsafe | P0 | ownership + versioned snapshot |
| Official company websites | company/evidence | global | public web with policy | partial via search | P1 | SSRF, provenance, fetch policy |
| Google Places/Business | local discovery/listings | supported markets | official API | documented_only | P6 | price/terms/geography pilot |
| Yandex Business/Maps | local discovery/listings | CIS | API/search/manual depends capability | documented_only | P6 | official availability and rights |
| 2GIS | local discovery/listings | CIS | official/partner API where available | documented_only | P6 | contract and commercial terms |
| Review platforms | review/switching/reputation | market-specific | official/partner/search/manual | documented_only | P4/P6 | source-by-source rights |
| Job boards/company careers | hiring triggers | market-specific | official/public/search | documented_only | P4 | freshness/entity quality |
| AI answer engines | visibility observations | market-specific | official API/supported measurement/manual | documented_only | P5 | reproducibility/legal/cost |

## Access classifications

Each configured capability uses exactly one: `OFFICIAL_API`, `PARTNER_API`, `SEARCH_INDEX`, `PUBLIC_WEB`, `AUTHORIZED_SCRAPING`, `MANUAL_ONLY`, `UNAVAILABLE`.

## Registry record

Store provider, capability, markets/languages, access classification, auth/health, implementation status, cost model, rate limit, reliability, timeout/retry policy, data retention, terms review date and owner.

## Selection policy

Choose the cheapest reliable legal capability that satisfies evidence/quality requirements. Stop early after cheap rejection. Do not fan out to all enrichment providers by default. A provider failure degrades or pauses the capability according to policy; it never silently changes domain meaning.
