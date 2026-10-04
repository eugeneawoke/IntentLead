# Security threat model

## Protected assets

Workspace isolation, Glook-derived context, evidence artifacts, personal/contact data, provider credentials, billing/credits, opportunity decisions, suppression records, prompts/model outputs and cost budgets.

## Trust boundaries

- browser → Next.js;
- Next.js → Supabase;
- Next.js → worker;
- worker → provider;
- external web/source content → normalization/model;
- Glook → IntentLead;
- future MCP consumer → application capabilities.

All external content and provider output are untrusted. Authentication does not imply authorization to a workspace or resource.

## Priority threats and controls

| Threat | Required control | Verification |
|---|---|---|
| Glook scan IDOR | owner-bound versioned contract; no bare service-role UUID read | negative cross-user API tests |
| Cross-tenant access | RLS plus application membership checks | real DB matrix for every table |
| Worker spoof/replay | timestamped HMAC, nonce/idempotency, rotation, private network when possible | expired/replayed/wrong signature tests |
| Empty/missing worker secret | fail startup and authentication closed; never substitute an empty value | missing/empty/wrong secret tests |
| Rate/quota bypass | await limit checks and use atomic owner-bound quota RPCs | enforcement and concurrent-request tests |
| Duplicate charge | idempotent deliverable key and ownership-validating RPC | concurrent DB test |
| Lost/duplicated job | lease, heartbeat, step idempotency and recovery | crash/restart integration test |
| SSRF | scheme/host policy, DNS/IP validation before and after redirects, size/time limits | private/rerouted host fixtures |
| Prompt injection | typed extraction, delimiters, least-capability tools, evidence policy, output validation | adversarial benchmark |
| Evidence poisoning | immutable source capture, content hash, provenance, fact/interpretation split | tamper/schema tests |
| Stored XSS/HTML | sanitize evidence previews; safe text rendering | payload tests |
| CSV injection | prefix/escape formula cells | export tests |
| PII leakage | data classification, retention, redacted logs, least access | log scan and deletion tests |
| Cost abuse | per-workspace/capability budgets, rate limits, max_cost | concurrency and budget tests |
| MCP privilege escalation | token scopes mapped server-side; workspace never trusted from input | tool authorization tests |
| Suppression bypass | centralized policy check before outreach/export | suppressed-contact tests |

## Service-role policy

Service role exists only in narrow server/worker repositories. Each operation still receives a validated tenant subject and enforces ownership in its query or RPC. No browser bundle, generic helper or MCP tool receives the key.

## Local Task 2 controls (2026-10-04, not deployed)

- Both direct Glook reads require authenticated ownership and completed status. Foreign, absent and not-ready scan responses are identical.
- Campaign creation awaits the existing asynchronous limiter. Chat plan/strategy reservation uses `intentlead_consume_chat_quota(workspace_id, user_id)`: SQL checks the owner, locks the workspace row, derives its existing plan limit, and resets/increments on UTC boundaries inside one transaction. The RPC is executable only by `service_role`; it does not charge credits.
- Worker signatures use HMAC-SHA256 over newline-separated `v1`, method, exact path plus query, SHA-256 of raw body bytes, Unix-second timestamp and UUID-v4 nonce. Headers are `x-worker-timestamp`, `x-worker-nonce`, and `x-worker-signature`. The receiver compares fixed-size digests in constant time, allows at most 60 seconds of clock skew, and rejects the former raw-key header.
- `intentlead_claim_worker_nonce` independently validates timestamp freshness and claims a unique nonce in PostgreSQL before execution. Only `service_role` may execute it; the RLS-enabled table has no client policies or direct role grants. Database failure returns 503 without executing work. Expired records are removed on subsequent claims after the last acceptable timestamp second; rows carry no tenant/source content.
- All deterministic checks pass; real DB concurrency and privilege tests are pending a disposable local PostgreSQL runtime. This change does not satisfy the production security release gate or durable-job requirements by itself.

## Compliance boundary

Public availability does not grant unrestricted commercial use. Every source has a legal/access status and market policy. Outreach remains human-approved, opt-outs enter a suppression list, and regional requirements are configuration inputs. Legal conclusions require qualified review; project documents are engineering controls, not legal advice.

## Security release gate

No production pilot until Glook ownership, RLS matrix, worker replay, idempotent charging, SSRF, prompt injection, log redaction and suppression tests pass. Harness security scanners such as ECC AgentShield may inspect agent/hook/MCP configuration, but do not replace application security review.
