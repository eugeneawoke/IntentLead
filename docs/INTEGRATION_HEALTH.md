# Integration health

**Status date:** 2026-10-06.

| Integration | State | Current use |
|---|---|---|
| Supabase local/PostgreSQL | verified in disposable integration runs | authoritative local state, RLS and durable jobs |
| Recorded fixture providers | wired and verified locally | zero-spend self-prospecting |
| Reddit/HN | provider adapters exist; live use not authorized | disabled |
| Exa/Serper/OpenAI | provider adapters exist; paid/live use not authorized | disabled |
| GitHub/Stack Exchange | target free/legal source capabilities | planned |
| Public career pages/jobs | target hiring/event capability | planned |
| Official company websites | identity, context and public business-contact fallback | planned |
| Prospeo/Hunter/Apollo | historical implementations removed; clean typed rebuild required | planned / missing credentials |
| CIS/local source catalog | registry entries and market profiles | planned/manual-only by source |
| Glook snapshot consumer | locally implemented, producer absent | dormant optional adapter |
| Glook direct table read | removed from active runtime | absent |

Health states are `configured`, `missing_credentials`, `disabled`, `rate_limited`, `degraded` or `error`. Provider availability never changes product policy.

The current runtime has no live multi-source, contact or draft mode. Those are implementation gaps, not accepted product exclusions. No provider will be enabled live until its current access, terms, credentials, cost and fixture behavior are checked.

Fixture mode records zero requests and zero cost for its HN-, Exa- and OpenAI-shaped synthetic outputs. It installs a process network guard that permits only the configured Supabase origin and rejects redirects. These provider labels identify a contract shape; they do not claim a live call or recorded real-company provenance.
