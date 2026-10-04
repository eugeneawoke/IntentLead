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
