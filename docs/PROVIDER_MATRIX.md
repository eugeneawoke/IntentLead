# Provider capability matrix

**Status:** Target catalog and current implementation truth, 2026-10-06. Access, pricing, free tiers and commercial terms must be revalidated against current primary provider documentation before live use.

Status values: `implemented`, `fixture_only`, `planned`, `missing_credentials`, `paid_locked`, `manual_only`, `unavailable`, `disabled`.

| Provider/family | Capability | Market | Access class | Current state | Priority / rule |
|---|---|---|---|---|---|
| Synthetic fixture | discovery through assessment | all test profiles | local fixture | implemented | contract/infrastructure only |
| Recorded authorized evidence | discovery through assessment | declared by bundle | external authorized file | implemented | evaluation without live calls |
| Reddit | public expressed intent | global | official API | implemented, not live-wired | first global portfolio after terms/credentials check |
| Hacker News Algolia | public expressed intent | global/tech | official public API | implemented, not live-wired | first global portfolio |
| GitHub Issues/Discussions | developer pain, projects and changes | global/tech | official API/public web | planned | free/legal priority |
| Stack Overflow / Stack Exchange | technical questions and pain | global/tech | official API | planned | free/legal priority |
| Product Hunt | launches and product context | global | official/public access varies | planned | enable only after access check |
| G2 / Capterra / Trustpilot | reviews, comparisons and recurring pain | global | partner/API/public web varies | planned/manual_only | no prohibited scraping |
| Public career pages | hiring and capability investment | global/CIS/local | public web | planned | prefer Greenhouse/Lever/Ashby public endpoints where allowed |
| Greenhouse / Lever / Ashby | structured hiring signals | global | public/company APIs | planned | free/legal priority |
| Company blogs/changelogs/press | launches, expansion and changes | global/CIS/local | public web/RSS | planned | low-cost context |
| Public news/search | events and company context | global/CIS/local | search index/provider | planned | provider-selected |
| LinkedIn / X | public professional/social signals | global | partner/official access only | disabled | never bypass access controls |
| Public Slack/Discord/Telegram | community signals | market-specific | official/authorized access only | disabled/manual_only | enable per source and consent/legal policy |
| Exa | web/company/person discovery | global | partner API | implemented, paid_locked | no live use before demand/spend gate |
| Serper | search/company discovery | global | partner API | implemented, paid_locked | no live use before demand/spend gate |
| Google Custom Search | public web/company lookup | global | official API | planned | free quota/cost must be revalidated |
| Jina Reader/extraction | content extraction | global | public/partner API | planned | compare access/cost before adoption |
| Official company website | identity, business context and public contact | global/CIS/local | public web | planned | primary zero-cost contact fallback |
| Prospeo | person/email find and verification | provider markets | partner API | paid_locked; fixture contract planned | demand-gated enrichment candidate |
| Hunter | email find and verification | provider markets | partner API | paid_locked; fixture contract planned | demand-gated enrichment candidate |
| Apollo | people/company/email discovery | provider markets | partner API | paid_locked; fixture contract planned | demand-gated; found is not verified |
| OpenAI / Anthropic / Gemini / local model | structured intake, bounded reasoning and drafting | policy-dependent | model API/local runtime | registry/contract implemented; paid models locked | one founder-selected adapter first; live budget explicit |
| Yandex Search | regional discovery/context | CIS/RU/BY/KZ | search index/API varies | planned | regional priority; verify access |
| Yandex Maps/Business | local company/listing/review evidence | CIS/RU | official/public/manual varies | planned/manual_only | concrete evidence, no generic audit |
| Yandex Webmaster/Wordstat | owner-authorized/search-demand evidence | CIS/RU | official/owner/manual | planned/manual_only | requires authorization where applicable |
| 2GIS | local business discovery/listings | CIS/local | official API/public access varies | planned | verify commercial terms |
| vc.ru / Habr / qna.habr.com / Dzen | public content and discussions | CIS | public web/search index | planned | source-specific policy required |
| VK public communities | public intent/community evidence | CIS | official API/public access | planned | source-specific policy required |
| Telegram public sources | public community evidence | CIS/global | official/authorized access varies | planned/manual_only | no private-group access |
| Startpack / Otzovik / Zoon / Flamp | comparison/review/local evidence | CIS/local | public/partner access varies | planned/manual_only | use only allowed access |
| TenChat / Profi / Avito Services | public business/service context | CIS/local | access varies | manual_only | not assumed API-available |
| Regional directories/job/news | local discovery/events | custom | market-specific | planned | configured per MarketProfile |
| Glook snapshot | optional versioned business context | optional | owner-authorized contract | implemented dormant | not a first-slice dependency |

## Selection policy

- Source planning selects a relevant portfolio; it does not call every provider.
- Free/legal/healthy sources run before paid providers.
- `paid_locked` providers are ineligible regardless of credentials until a separate founder spend gate changes their state.
- Contact enrichment begins only after evidence, company and ICP qualification.
- Provider discovery and independent verification are distinct capabilities.
- A missing key returns `missing_credentials` and allows an authorized fallback.
- Every run records source, schema/provider version, access class, request count, cost, latency and outcome.
- No provider can expose a sending capability.
