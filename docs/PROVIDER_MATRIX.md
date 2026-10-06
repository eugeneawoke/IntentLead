# Provider capability matrix

**Status:** 2026-10-06. Runtime truth must be verified against code and credentials.

| Provider/family | Capability | Current role | Roadmap status |
|---|---|---|---|
| Recorded fixtures | discovery, evidence, company resolution | available locally | required for zero-spend pilot |
| Reddit | public expressed-intent discovery | legacy adapter exists | evaluate after fixture gate |
| Hacker News | public expressed-intent discovery | legacy adapter exists | evaluate after fixture gate |
| Exa | web/company discovery | wrapped adapter exists | disabled without explicit budget |
| Serper | fallback web/company discovery | wrapped adapter exists | disabled without explicit budget |
| OpenAI | bounded interpretation | current schemas/wrappers exist | disabled in zero-spend run unless mocked |
| Public company website | business-context extraction | no dedicated target adapter | later; product/audience/positioning only |
| Glook | optional business-context snapshot | dormant consumer adapter | deferred |

Personal-contact and email providers are legacy implementation artifacts scheduled for removal from the active runtime. They are not required by the accepted roadmap.

Every active provider must declare markets, legal/access status, cost model, rate limits, timeout, reliability, schema version and provenance behavior.
