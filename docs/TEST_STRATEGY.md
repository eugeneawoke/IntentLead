# Test strategy

## Required layers

1. Contract tests for every versioned domain/provider schema.
2. Unit tests for deterministic policy, source planning, state transitions and normalization.
3. Disposable PostgreSQL tests for migrations, RLS, concurrency, leases, deletion and idempotency.
4. Application integration tests for capability authorization and durable jobs.
5. Provider fixture tests for normalization, health, timeout, retry, fallback, cost and provenance.
6. Product/AI eval fixtures for Opportunity, buyer/contact and grounded-draft quality.
7. Browser tests for intake, progress, Opportunity evidence, contact/draft inspection and human review.
8. Production build and both app/worker typechecks.

## Mandatory first-slice cases

- foreign workspace denial through every API/RPC/read path;
- at least 20 confirmed signals in a full-size recorded corpus, with raw/confirmed/unique-company/package counts separated;
- transparent `PARTIAL` when quality-valid results are fewer than the requested target;
- source plan varies correctly for global SaaS, CIS and local-business briefs;
- unavailable/prohibited providers are never selected;
- discovery job recovery, cancellation and idempotent rerun;
- evidence remains accessible, immutable and correctly scoped;
- wrong-company, wrong-person, weak, stale, duplicate and non-commercial candidates reject cleanly;
- every delivered contact has source, current company/role relation, verification state and freshness;
- no guessed email, role or identity;
- every material draft claim references evidence; unsupported claims fail closed;
- external text cannot create evidence, alter instructions or invoke providers/actions;
- no send, mailbox, sequence, follow-up, delivery-tracking or billing capability is invoked or rendered;
- direct Glook table access remains unreachable;
- owner-authorized deletion removes/redacts source, contact and draft data according to policy.

## Reliability targets

- tenancy, no-send, idempotency and provenance deterministic invariants: `pass^3 = 1.00`;
- capability/product evals: `pass@3 >= 0.90` on versioned recorded fixtures;
- ambiguous product value requires human adjudication rather than a flaky model-only gate.

## Gates

During implementation and before an intermediate commit: run focused tests for directly changed behavior, plus the relevant typecheck/lint when compilation or static rules can change. Do not repeat a green repository-wide suite after unrelated documentation or narrow fixture edits.

At the end of a milestone: run `npm run verify`, the relevant disposable DB suite, focused browser journeys, security/product evals and independent functional/security/frontend review once. After a failure, rerun only the failed or directly affected set; repeat the full gate only when the fix is broad.

No live-provider smoke, remote migration or production canary is implied by a local green build.
