# Developer runbook

## Prerequisites

- Node.js compatible with the lockfile/toolchain.
- Supabase CLI and a disposable local project for DB integration tests.
- Environment values copied from `.env.example`; never commit `.env` files.
- Optional provider credentials only for explicit live smoke tests.

## Install and baseline

```bash
npm ci
npm run build
npx vitest run tests --exclude 'tests/e2e/**' --exclude '.claude/**' --exclude '.worktrees/**'
npx tsc -p worker/tsconfig.json --noEmit
```

Standalone app `tsc` currently fails in `tests/auth.test.ts`; Phase 0 fixes this and introduces stable scripts. Do not hide the baseline failure.

## Local services

Start local Supabase using the project CLI, apply migrations to a disposable database, then run app and worker in separate terminals. The worker requires the same Supabase URL/service role and a shared `WORKER_SECRET`; the app uses `WORKER_URL` to dispatch.

Until durable jobs are implemented, the current worker background promise is development-only reliability and must not be treated as a production queue.

Task 2 replaces `X-Internal-Key` with timestamped HMAC headers. The app signs requests automatically; internal health probes also need signed method/path/body/timestamp/nonce requests. Missing or blank `WORKER_SECRET` stops worker startup. Deploying this change later requires the additive `202610040000_atomic_chat_quota.sql` migration first and compatible app/worker versions; quota/replay database failures intentionally deny execution. No production rollout is authorized by local implementation.

### Task 2 database integration

Use an **empty disposable local PostgreSQL database** whose name starts with `intentlead_test_`, with a fixture PostgreSQL superuser able to create the Supabase role/schema stubs (including `service_role BYPASSRLS`), inspect session wait events and cancel the fixture's blocking session. Set `INTENTLEAD_TEST_DATABASE_URL` to that database and run:

```bash
npm run test:integration -- tests/integration/chat-quota-concurrency.test.ts
```

The suite rejects remote addresses and other database names, requires `psql`, applies the relevant existing baseline migrations (001, 002, 006), and upgrades it with Task 2's additive migration. It grants representative default/table privileges before the upgrade, plus historical workspace column grants, so denial proves the migration's revocations. Its 31 cases cover quota limits/reset/ownership, concurrent connections, delayed replay versus expiry cleanup, nonce-table denial for all three roles (including RLS-bypassing service role), protected workspace fields, allowed owner rename and preserved server creation. The delayed-race fixture uses a temporary trigger/advisory lock, bounded wait-state polling and cancellation of only its own named blocker; it does not replace PostgreSQL with a mock. Each run needs a fresh empty disposable database; fixture state is left there for inspection. This narrow upgrade test is not the full from-zero migration gate assigned to Task 4.

The initial 2026-10-04 run failed at setup because `INTENTLEAD_TEST_DATABASE_URL` and a working local database runtime were unavailable. That blocker is now superseded: the coordinating agent ran this command against a disposable local `postgres:16-alpine` container and all **31/31 real PostgreSQL tests passed in 8.23 seconds**, including quota contention and delayed replay after expiry cleanup. The container was removed after the run. No remote/production migration or deployment occurred. Reproduction still requires a new empty disposable database; the recorded result is actual PostgreSQL evidence, not mocked concurrency.

## Safe provider development

- Default to recorded fixtures and fake adapters.
- Live tests require explicit env flags and a cost cap.
- Never record secrets or unredacted personal payloads in fixtures.
- Verify provider health separately from business-flow tests.

## Database change procedure

1. Design forward migration and rollback/compensating plan.
2. Add RLS policies in the same change.
3. Test from a clean database and supported upgrade state.
4. Test owner/member/outsider/anonymous access.
5. Test concurrency/idempotency for credit and job changes.
6. Review migration with the database/security reviewer before remote apply.

## E2E

Run Playwright against a dedicated test environment and seeded accounts. Tests must not contact real prospects or consume production credits. Save screenshots/traces for failures; keep generated reports out of unit-test discovery and commits unless intentionally attached.

## Release

Use the release evidence packet from `AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md`. Production migration/deploy and any real outreach require an explicit human checkpoint.
