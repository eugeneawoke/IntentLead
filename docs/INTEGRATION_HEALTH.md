# Integration health

**Status date:** 2026-10-06.

| Integration | State | Current use |
|---|---|---|
| Supabase local/PostgreSQL | verified in disposable integration runs | authoritative local state, RLS and durable jobs |
| Recorded fixture providers | planned next wiring | zero-spend self-prospecting |
| Reddit/HN | code exists; live credentials/use not authorized | disabled |
| Exa/Serper/OpenAI | wrapped; paid/live use not authorized | disabled or mocked |
| Glook snapshot consumer | locally implemented, producer absent | dormant optional adapter |
| Glook direct table read | legacy security debt | remove |
| Personal-contact/email providers | legacy code | remove from active runtime |

Health states are `configured`, `missing_credentials`, `disabled`, `rate_limited`, `degraded` or `error`. Provider availability never changes product policy.
