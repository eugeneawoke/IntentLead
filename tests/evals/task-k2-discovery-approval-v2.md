# Task K2 Discovery Approval V2 Eval

**Version:** 2.0.0
**Status:** executable contract gate before implementation
**Scope:** fixture-only conversational review to service-role-only approved DiscoveryBrief creation

## Invariants

- V1 create commands remain valid and retain their existing persistence shape.
- The existing generic application/API/RPC path remains strictly V1-only and rejects V2.
- A V2 command is produced only from a schema-valid `READY_FOR_REVIEW` review whose submitted fingerprint exactly matches the review fingerprint.
- Offer summary/outcomes, company description, nullable buyer description, raw market intent, languages, exclusions and requested confirmed signals round-trip exactly.
- Raw market intent is distinct from explicitly mapped normalized jurisdictions.
- Requested confirmed signals is between 20 and 500 and is distinct from `maxSourceItems` and `maxOpportunities`.
- Every execution language has exactly one mapping: `USER_STATED` preserves an exact review value, while `HUMAN_ADDED` requires a rationale and nullable language intent.
- Prompt metadata and model telemetry are preserved under immutable intake approval metadata with `humanApproved: true`.
- The derived idempotency key is stable for the same approved command and changes when any V2-only value changes.
- Only the dedicated service-role RPC may persist V2; it receives the authenticated user id explicitly, authenticated SQL execution is denied and no job is created.
- Reusing one V2 idempotency key with changed V2-only values returns an idempotency conflict.
- Preparation is pure with respect to persistence and provider/model/job execution.

## Deterministic cases

| Case | Expected |
|---|---|
| Valid complete review and complete human mapping | Exact V2 command and stable key |
| Same input replay | Byte-equivalent command and identical key |
| Stale submitted fingerprint | `INVALID_INPUT` |
| Clarification-state review | `INVALID_INPUT` |
| Missing or extra market/language mapping | `INVALID_INPUT` |
| Empty review language plus explicit `HUMAN_ADDED` mapping | Exact mapped language and rationale |
| V1 database command | Existing V1 round trip unchanged |
| V2 database command | Exact V2 round trip, nullable buyer preserved |
| Authenticated call to dedicated V2 RPC | Permission denied |
| Service-role call with explicit user id | Tenant-scoped creation |
| Changed V2-only replay under same key | `idempotency_conflict` |
| Authenticated second tenant | Isolated offer, ICP and brief rows |
| V2 creation | Zero `intentlead_jobs` rows |

## Judges

1. Focused Vitest domain/application tests for schemas, mapping, replay and failures.
2. Authored disposable-PostgreSQL integration test for V1/V2 persistence, tenant scope, replay conflict and zero jobs.
3. App TypeScript typecheck.
4. Targeted ESLint for changed TypeScript files.

## Result

2026-10-10 focused deterministic result:

- `npx vitest run --config vitest.config.ts tests/domain/discovery-brief-v2.test.ts tests/application/conversational-intake-approval.test.ts tests/application/discovery-briefs.test.ts tests/domain/conversational-intake.test.ts tests/application/conversational-intake.test.ts`
- 5 files, 34 tests, three consecutive passes after the final service-boundary refactor (`pass^3 = 1.00`).
- `npm run typecheck:app` passed.
- `npm run typecheck:worker` passed.
- Targeted ESLint for changed TypeScript and tests passed with zero findings.
- `tests/integration/taskk2-discovery-approval.test.ts` is authored but was not executed because `INTENTLEAD_TEST_DATABASE_URL` was unavailable. No PostgreSQL success is inferred.
- Initial independent architecture and QA reviews rejected the first implementation for an approval bypass, incomplete replay identity and missing language provenance. Those findings were resolved by keeping the generic path V1-only, isolating V2 behind a service-role capability, hashing the complete approved command and adding explicit `HUMAN_ADDED` language provenance. A post-fix independent re-review could not run because the agent account reached its external usage limit; the final diff received root manual review plus the focused deterministic gates above and is not represented as independently approved.
