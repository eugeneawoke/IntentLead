# Integration health

**Status date:** 2026-10-10.

| Integration | State | Current use |
|---|---|---|
| Supabase local/PostgreSQL | verified in disposable integration runs | authoritative local state, RLS and durable jobs |
| Recorded fixture providers | wired and verified locally | zero-spend self-prospecting |
| Reddit/HN | provider adapters exist; live use not authorized | disabled |
| Exa/Serper | provider adapters exist; paid/live use is demand-gated | paid_locked |
| Conversational/model layer | provider-neutral registry, evidence/budget boundary, immutable prompt metadata and bounded review-only intake port implemented; no API/UI, persistence or live model is wired | deterministic fixture eval passed; live budget zero |
| GitHub/Stack Exchange | bounded adapters execute together in the durable no-network fixture workflow with separate runs/provenance | implemented, live disabled |
| Public career pages/jobs | target hiring/event capability | planned |
| Official company websites | company-scoped role-contact fallback is fixture-verified behind a mandatory authority-aware public-egress boundary; business-context adapter remains planned | contact adapter implemented, live disabled |
| Prospeo/Hunter/Apollo | historical implementations removed; catalog/fixture contracts only until demand gate | paid_locked |
| CIS/local source catalog | `CIS`, `RU`, `BY`, `KZ` and local planning foundations plus explicit source states | planned/manual-only by source |
| Glook snapshot consumer | locally implemented, producer absent | dormant optional adapter |
| Glook direct table read | removed from active runtime | absent |

Activation/health states are `configured`, `fixture_only`, `missing_credentials`, `paid_locked`, `planned`, `manual_only`, `disabled`, `unavailable`, `rate_limited`, `degraded` or `error`. Provider availability never changes product policy, and credentials do not unlock `paid_locked` providers.

The current runtime has no live multi-source, contact, conversational or draft mode. The conversational intake slice is review-only and fixture-tested: it cannot persist a DiscoveryBrief, start a job, choose providers or perform an external action. Its lexical support ledger proves where a value came from, not whether the model interpreted meaning or polarity correctly; human approval remains required. The durable source fixture path does execute a no-network GitHub + Stack Exchange source portfolio, then deterministic company resolution and assessment, with separate provider runs and exact provenance. Live free/legal providers are enabled one at a time after access review. Paid providers additionally require demonstrated demand, an explicit founder gate and a cost ceiling.

Fixture mode records one logical request for each GitHub and Stack Exchange fixture adapter, zero external requests for deterministic Exa-shaped company resolution and OpenAI-shaped assessment, and zero cost throughout. A process network guard permits only the configured Supabase origin, rejects redirects and issues the authority required by the portfolio registry outside tests. These provider labels identify contract shapes; they do not claim a live call or recorded real-company provenance.
