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

Use `npm run typecheck:app` and `npm run typecheck:worker` for strict app/worker checks. `npm run verify` runs both checks, lint, unit tests and the production build.

## Local services

Start local Supabase using the project CLI, apply migrations to a disposable database, then run app and worker in separate terminals. The worker requires the same Supabase URL/service role and a shared `WORKER_SECRET`; the app uses `WORKER_URL` to dispatch.

Durable PostgreSQL enqueue and an independently polling worker replace request-bound background execution. The active API is DiscoveryBrief-based; campaign routes are retired. This local implementation is not a production rollout or production queue-readiness approval.

Task 2 replaces `X-Internal-Key` with timestamped HMAC headers. The app signs requests automatically; internal health probes also need signed method/path/body/timestamp/nonce requests. Missing or blank `WORKER_SECRET` stops worker startup. Deploying this change later requires the additive `202610040000_atomic_chat_quota.sql` migration first and compatible app/worker versions; quota/replay database failures intentionally deny execution. No production rollout is authorized by local implementation.

### Native durable discovery jobs and deletion

- Apply migrations in order through `202610060016_native_discovery_authority.sql` to a disposable local database before exercising this runtime. The forward migration adds owner-scoped native create/list/context RPCs and replaces enqueue/terminal synchronization without rewriting applied history. No remote migration or deployment has been performed.
- `POST /api/discovery-briefs` atomically creates versioned OfferProfile, ICPDefinition, EN_DISCOVERY_ONLY MarketProfile and DiscoveryBrief under an idempotency key. `POST /api/discovery-briefs/{id}/run` commits through `intentlead_enqueue_discovery_job` before returning HTTP 202, then sends a signed `{jobId}` wake hint. Missing or rejected wake configuration does not undo durable work; independent polling is the liveness source.
- Worker startup fails closed unless `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `WORKER_SECRET` are non-empty. `PORT` defaults to 3001, `WORKER_ID` defaults to a process-derived id, `WORKER_CONCURRENCY` defaults to 2 (allowed 1–32), and `WORKER_LEASE_SECONDS` defaults to 60 (allowed 5–3600). `WORKER_HEARTBEAT_INTERVAL_MS` defaults to one third of the configured lease duration; any explicit value outside 1,000 ms through that conservative bound is rejected before the worker accepts HTTP. Polling uses bounded backoff with jitter, cancellation checks, and graceful SIGTERM/SIGINT shutdown. The worker exposes an injectable per-provider concurrency hook; Task 5 wires no provider-specific limiter.
- Application context, enqueue service and worker all fail closed unless the native brief and stored profile are `EN_DISCOVERY_ONLY` with `DISCOVERY_ONLY` workflow. Discovery/review operations are allowed only when the profile declares them; contact, email, draft, outreach, outcome and `PACKAGE_VERIFIED` remain denied. Terminal job state synchronizes only the DiscoveryBrief; it never reads or writes a campaign. Terminal writes serialize with owner deletion.
- `SELF_PROSPECTING_MODE=disabled` is the safe default and leaves the unavailable-capability handler in place. `SELF_PROSPECTING_MODE=fixture` injects the synthetic deterministic contract workflow. `SELF_PROSPECTING_MODE=recorded` requires `SELF_PROSPECTING_RECORDED_EVIDENCE_PATH` pointing to a local, schema-valid, sanitized and explicitly authorized JSON evidence file; repository code contains no recorded dataset. Both enabled modes permit network access only to the configured Supabase origin, reject redirects, record zero provider requests and zero cost, and never invoke live Reddit, HN, Exa, Serper or OpenAI endpoints. Any other mode fails worker startup.
- Apply `202610060017_fixture_self_prospecting.sql` only to a disposable local database for this milestone. It aligns persisted signal validation with `EXPRESSED_INTENT`, `BUSINESS_EVENT`, `DETECTED_PROBLEM` and `MARKET_OBSERVATION`, and adds a lease-bound service-role context RPC. No production migration has been performed or authorized.
- `DELETE /api/discovery-briefs/{id}` calls the owner-checked `intentlead_delete_discovery_brief` boundary. Native briefs have no legacy campaign link; deletion cancels and redacts owned work while preserving shared evidence and suppression minima. Historical campaign-linked deletion behavior remains migration debt until Task E and is not reachable through the active context API.
- Provider/Supabase backup expiry is unverified. Do not promise deletion from backups or authorize a production pilot until the actual provider retention/expiry behavior is externally confirmed and documented.

### Task 2 database integration

Use a local PostgreSQL server and a seed URL whose database name starts with `intentlead_test_`, with a fixture PostgreSQL superuser able to create/drop sibling test databases and create the Supabase role/schema stubs (including `service_role BYPASSRLS`). The runner validates localhost plus the database prefix, then creates and removes an isolated database for every selected integration file. Set `INTENTLEAD_TEST_DATABASE_URL` and run the full suite or a selected file:

```bash
npm run test:integration
npm run test:integration -- tests/integration/chat-quota-concurrency.test.ts
```

The runner rejects remote addresses and other database names and requires PostgreSQL CLI tools. The selected suite applies its own relevant migrations inside its isolated database. The historical chat/worker suite grants representative default/table privileges before its upgrade, plus historical workspace column grants, so denial proves the migration's revocations. Its 31 cases cover quota limits/reset/ownership, concurrent connections, delayed replay versus expiry cleanup, nonce-table denial for all three roles (including RLS-bypassing service role), protected workspace fields, allowed owner rename and preserved server creation. The delayed-race fixture uses a temporary trigger/advisory lock, bounded wait-state polling and cancellation of only its own named blocker; it does not replace PostgreSQL with a mock.

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
5. Test concurrency/idempotency for job and candidate changes.
6. Review migration with the database/security reviewer before remote apply.

## E2E

Run Playwright against a dedicated test environment and seeded accounts. Tests must not contact real prospects or consume provider spend. Save screenshots/traces for failures; keep generated reports out of unit-test discovery and commits unless intentionally attached.

## Release

Use the release evidence packet from `AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md`. Production migration/deploy and any real outreach require an explicit human checkpoint.
