# Backend and frontend test strategy

## Test layers

### Static and build

- App and worker TypeScript are separate commands.
- Next production build is mandatory.
- Lint must target source only; generated output, worktrees and reports are excluded.
- Schema/type generation drift is checked after migrations.

### Unit

Cover pure state transitions, assessment policy, freshness, dedupe, cost budgeting, provider selection, error mapping, evidence-claim validation and market capability resolution.

### Provider contract

Every adapter uses sanitized recorded fixtures for success, empty, malformed, rate-limited, timeout, auth failure and schema drift. The `EN_DISCOVERY_ONLY` milestone uses a zero-spend fixture/mock smoke; live provider calls remain deferred until a free-only path proves zero external spend or separate authorization.

### Database integration

Run against disposable local Supabase/Postgres:

- migrations from zero and upgrade from the supported baseline;
- RLS allow/deny for owner, member, outsider and unauthenticated user;
- credit concurrency and ownership;
- idempotent rerun and duplicate dispatch;
- job lease/recovery/cancellation;
- immutable evidence and audit rows;
- deletion/retention effects.
- owner-authorized deletion across all stores used by the milestone; if object artifacts/embeddings/eval copies are disabled, assert they were not created and record the backup-expiry boundary.

Mocks cannot prove these properties.

### Pipeline integration

Use fake adapters and a real database to cover:

- expressed intent model QUALIFY/REVIEW/REJECT plus separate human decisions;
- detected problem and visibility finding semantics;
- wrong company or unsupported buyer-role hypothesis, without people lookup in the discovery-only slice;
- insufficient evidence;
- stale and already-solved signal;
- provider fallback, rate limit and circuit-open behavior;
- partial failure and recovery;
- budget ceiling;
- no charge on rejected/failed/duplicate deliverable.
- under `EN_DISCOVERY_ONLY`, no contact/people lookup, email find/verify, draft generation, outreach-ready/sent/reply transition or `PACKAGE_VERIFIED` charge, including after model `QUALIFY` and human `ACCEPT`.

### Security

Mandatory cases: Glook IDOR/cross-tenant access, service-role misuse, worker replay, SSRF/private IP/redirect/DNS rebinding, prompt injection, evidence poisoning, stored HTML/XSS, CSV formula injection, unauthorized export, suppression bypass and sensitive-log redaction.

### Frontend component/integration

Test Opportunity states, evidence rendering, fact-vs-interpretation labels, loading/empty/partial/error/retry, human decision reasons, suppression warning, budget warning and keyboard interactions.

### Playwright E2E

Critical paths:

1. anonymous cold intake → auth transfer → discovery job;
2. owned Glook warm handoff and denial for foreign scan;
3. job progress → Opportunity → evidence inspection;
4. accept/reject/needs-research review, with direct downstream capability calls denied by `EN_DISCOVERY_ONLY`;
5. no contact, draft, copy/mailto/export-for-outreach or sent/reply controls under `EN_DISCOVERY_ONLY`;
6. provider/configuration failure and retry;
7. mobile viewport, keyboard-only and accessibility smoke;
8. no fake proof or hidden limitations.

### Milestone smoke and later production canary

For this milestone, run a controlled local workspace and one bounded fixture/mock Opportunity with zero provider spend. Verify policy-denied contact/draft/outreach/credit, no PII in logs, job recovery alerting, evidence access and rollback readiness. Live provider smoke and production canary are separate later gates.

## Commands target

```text
npm run typecheck:app
npm run typecheck:worker
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
```

The backlog creates missing scripts before implementation work relies on them.

## Merge gate

A task passes only if focused tests pass, affected full suites pass, no unrelated diff exists, fresh review has no unresolved blocking finding, and evidence is attached. AI quality and provider health are separate gates; a green unit suite does not prove them.
