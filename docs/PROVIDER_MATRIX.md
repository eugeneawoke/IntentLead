# Provider capability matrix

**Status:** 2026-10-06. Runtime truth must be verified against code and credentials.

| Provider/family | Capability | Current role | Roadmap status |
|---|---|---|---|
| Synthetic contract fixture | discovery, evidence, company resolution, deterministic assessment | wired locally with network guard | infrastructure-only fixture |
| Recorded authorized evidence | discovery, evidence, company resolution, deterministic assessment | local JSON input via `SELF_PROSPECTING_MODE=recorded`; schema-validated, sanitized, no-network and zero-cost | required for zero-spend pilot |
| Reddit | public expressed-intent discovery | adapter exists but is not wired to the pilot | evaluate after fixture gate |
| Hacker News | public expressed-intent discovery | adapter exists but is not wired to the pilot | evaluate after fixture gate |
| Exa | web/company discovery | wrapped adapter exists | disabled without explicit budget |
| Serper | fallback web/company discovery | wrapped adapter exists | disabled without explicit budget |
| OpenAI | bounded interpretation | deterministic synthetic assessment in fixture mode; live adapter disabled | live use requires a later budget decision |
| Public company website | business-context extraction | no dedicated target adapter | later; product/audience/positioning only |
| Glook | optional business-context snapshot | dormant consumer adapter | deferred |

Personal-contact and email providers are absent from the active runtime and are not required by the accepted roadmap.

Every active provider must declare markets, legal/access status, cost model, rate limits, timeout, reliability, schema version and provenance behavior.
