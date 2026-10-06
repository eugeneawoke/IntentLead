# Test strategy

## Required layers

1. Contract tests for every versioned domain/provider schema.
2. Unit tests for deterministic policy, state transitions and normalization.
3. Disposable PostgreSQL tests for migrations, RLS, concurrency, leases, deletion and idempotency.
4. Application integration tests for capability authorization and durable jobs.
5. Provider fixture tests for normalization, timeout, retry, cost and provenance.
6. AI evaluation fixtures for Opportunity quality and injection resistance.
7. Browser tests for discovery, job progress, Opportunity evidence and human review.
8. Production build and both app/worker typechecks.

## Mandatory first-pilot cases

- foreign workspace denial through every API/RPC/read path;
- fixture/no-network execution with total provider cost zero;
- discovery job recovery, cancellation and idempotent rerun;
- evidence remains accessible, immutable and correctly scoped;
- wrong-company, weak, stale, duplicate and non-commercial candidates reject cleanly;
- external text cannot create evidence or alter instructions;
- no personal-contact, message, mailbox, send or billing capability is invoked or rendered;
- retired lead/export/message routes are absent or return an explicit retired response;
- direct Glook table access is unreachable;
- owner-authorized deletion removes or policy-tombstones all owned workflow data.

## Gates

Before commit: focused tests, relevant typecheck/lint, GitNexus detect-changes.

Before dogfood: full `npm run verify`, disposable DB suite, browser journey, security/evaluation suite and independent functional/security review.

No live-provider smoke, remote migration or production canary is implied by a local green build.
