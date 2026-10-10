# Integration health

**Status date:** 2026-10-06.

| Integration | State | Current use |
|---|---|---|
| Supabase local/PostgreSQL | verified in disposable integration runs | authoritative local state, RLS and durable jobs |
| Recorded fixture providers | wired and verified locally | zero-spend self-prospecting |
| Reddit/HN | provider adapters exist; live use not authorized | disabled |
| Exa/Serper | provider adapters exist; paid/live use is demand-gated | paid_locked |
| Conversational/model layer | provider-neutral registry, evidence boundary and pre-call budget reservation implemented; no product chat is wired | fixture-tested, live budget zero |
| GitHub/Stack Exchange | target free/legal source capabilities | planned |
| Public career pages/jobs | target hiring/event capability | planned |
| Official company websites | identity, context and public business-contact fallback | planned |
| Prospeo/Hunter/Apollo | historical implementations removed; catalog/fixture contracts only until demand gate | paid_locked |
| CIS/local source catalog | registry entries and market profiles | planned/manual-only by source |
| Glook snapshot consumer | locally implemented, producer absent | dormant optional adapter |
| Glook direct table read | removed from active runtime | absent |

Activation/health states are `configured`, `fixture_only`, `missing_credentials`, `paid_locked`, `planned`, `manual_only`, `disabled`, `unavailable`, `rate_limited`, `degraded` or `error`. Provider availability never changes product policy, and credentials do not unlock `paid_locked` providers.

The current runtime has no live multi-source, contact, conversational or draft mode. The registries and contracts exist, but those product flows are implementation gaps, not accepted product exclusions. Free/legal providers are enabled one at a time after access review. Paid providers additionally require demonstrated demand, an explicit founder gate and a cost ceiling.

Fixture mode records zero requests and zero cost for its HN-, Exa- and OpenAI-shaped synthetic outputs. It installs a process network guard that permits only the configured Supabase origin and rejects redirects. These provider labels identify a contract shape; they do not claim a live call or recorded real-company provenance.
