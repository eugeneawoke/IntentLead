# Integration health

**Status date:** 2026-10-06.

| Integration | State | Current use |
|---|---|---|
| Supabase local/PostgreSQL | verified in disposable integration runs | authoritative local state, RLS and durable jobs |
| Recorded fixture providers | wired and verified locally | zero-spend self-prospecting |
| Reddit/HN | provider adapters exist; live use not authorized | disabled |
| Exa/Serper/OpenAI | provider adapters exist; paid/live use not authorized | disabled |
| Glook snapshot consumer | locally implemented, producer absent | dormant optional adapter |
| Glook direct table read | removed from active runtime | absent |
| Personal-contact/email providers | removed from active runtime | absent |

Health states are `configured`, `missing_credentials`, `disabled`, `rate_limited`, `degraded` or `error`. Provider availability never changes product policy.

Fixture mode records zero requests and zero cost for its HN-, Exa- and OpenAI-shaped synthetic outputs. It installs a process network guard that permits only the configured Supabase origin and rejects redirects. These provider labels identify a contract shape; they do not claim a live call or recorded real-company provenance.
