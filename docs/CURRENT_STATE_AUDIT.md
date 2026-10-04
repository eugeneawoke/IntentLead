# Current state audit

Audit date: 2026-10-04. Commit inspected: `37dceff` on `main`. This is a factual inventory, not the target architecture.

## Executive finding

IntentLead is an implemented MVP skeleton, not a documentation-only project. The root documentation still says “code not started” and describes Next.js 16, while the repository contains a Next.js 15.5.19 application, Supabase migrations, authenticated APIs, a Railway-style worker, pipeline code, UI and tests. Continuing from the old seven-phase build plan would repeat completed work and preserve the wrong `Lead`-centric domain boundary.

## Verified baseline

| Area | Current state | Evidence | Disposition |
|---|---|---|---|
| Web application | Implemented | Next.js routes, landing, chat, workspace, pricing, compare pages | Preserve; evolve surfaces around Opportunity |
| Framework | Next.js 15.5.19 at build time | `package.json`, successful build | Correct documentation before any upgrade decision |
| Auth/tenancy | Supabase Auth helpers and RLS migrations exist | `lib/auth`, `supabase/migrations/002_rls.sql` | Audit negative tenant cases |
| Campaign API | Create/list/run paths implemented | `app/api/campaigns/**` | Move orchestration behind application services |
| Signal sources | Reddit and Hacker News implemented | `worker/pipeline/signals.ts` | Treat all other sources as documented-only |
| Pipeline | Linear signal→lead pipeline implemented | `worker/pipeline/runner.ts` | Wrap and strangle; do not rewrite at once |
| Company resolution | Exa with Serper fallback | `worker/pipeline/company.ts` | Move behind provider capability contract |
| Contact role | Implemented with a fixed decision-maker policy | `worker/pipeline/contact.ts` | Replace with problem/company-aware buyer resolution |
| Email waterfall | Prospeo→Hunter→Apollo implemented | `worker/pipeline/email.ts` | Split discovery from verification and define status semantics |
| Credits | RPC called after four flags | migration + runner | Keep invariant; fix ownership and idempotency proofs |
| Message generation | Implemented after charge, retry loop | `worker/pipeline/message.ts`, runner | Require evidence-linked claims; reload enriched data |
| Glook warm path | Direct shared-table reads | `lib/glook/report.ts`, API route | Replace with versioned owned contract |
| Durable execution | Not implemented | in-memory background promise after HTTP 202 | Add database-backed job lease model |
| Evidence/provenance | Missing as first-class entities | no evidence table/contracts | Required before Opportunity rollout |
| Feedback/outcomes | Missing | no review/outcome entities | Required for product validation |
| MCP | Not ready | no stable application capabilities or job resource contract | Prepare boundaries now; release later |

## Verification run

Commands executed on 2026-10-04:

```text
npm run build
Result: PASS; Next.js 15.5.19; 26 static/dynamic route outputs.

npx vitest run tests --exclude 'tests/e2e/**' --exclude '.claude/**' --exclude '.worktrees/**'
Result: PASS; 7 files, 31 tests.

npx tsc -p worker/tsconfig.json --noEmit
Result: PASS.

npx tsc --noEmit
Result: FAIL in tests/auth.test.ts due unsafe mock cast to SupabaseClient.
```

The successful Next build type-checks production code, but standalone TypeScript is not green. The current `npm test` scope also needs permanent excludes for worktrees and Playwright tests. The file named `credit-atomicity.test.ts` uses mocked RPC behavior and does not prove database-level concurrency.

## Critical correctness and security findings

1. `getGlookContext(scanId)` uses service role and does not accept an owner/workspace identity. Any caller that reaches it without the ownership-checking route can read a scan by UUID. All warm paths must enforce ownership before service-role access.
2. Fire-and-forget dispatch marks a campaign running before confirmed job acceptance. Missing configuration, network failure or worker restart can leave permanent `running` state.
3. The worker has no lease, heartbeat, resume, cancellation or idempotency key. A restart loses the run.
4. A rerun can recreate a lead for an existing signal; the data model does not prove exactly-once charging across reruns.
5. Credit RPC must validate the workspace through the lead→campaign relationship rather than trust an independently supplied workspace id.
6. Email provider responses are not consistently separated into `found`, `deliverable`, `risky` and `verified` states.
7. Message generation receives the original inserted lead object, not a refreshed enriched projection; generated context may contain null company/contact fields.
8. Prompt injection controls require typed extraction, claim-to-evidence grounding and output validation; role separation alone is insufficient.
9. A campaign can become `done` after technical failures; product completion must distinguish completed, partial and failed.
10. Fixed global decision-maker roles do not support different problems, company sizes, industries and markets.
11. Campaign creation calls the asynchronous rate limiter without awaiting it, so the current truthiness check does not enforce the intended limit.
12. The chat daily counter uses a read-then-write update and can lose increments under concurrent requests.
13. Worker authentication permits an empty configured/default secret path; startup and requests must fail closed before staging.

## Local Task 2 follow-up (2026-10-04)

The branch now replaces the bare-scan helper with `getOwnedGlookContext({scanId,userId})`, adds owner/ready filters in both warm paths, awaits campaign limits, moves chat quota reservation to an owner-checked SQL RPC, and replaces raw worker secrets with request-bound HMAC plus persisted nonce claims. Reproduction: `npx vitest run tests/api/glook-ownership.test.ts tests/api/rate-limit-enforcement.test.ts tests/worker/authentication.test.ts` passes 35 tests; `npm run verify` passes all 66 deterministic tests, both typechecks and the Next build, with 24 existing lint warnings.

The Task 2 migration has **not** been applied remotely. Its real database suite exits 1 at setup because a disposable local database/runtime is unavailable; quota concurrency, migration execution and privilege behavior remain unverified on PostgreSQL. Findings 1/11/12/13 above describe the original inspected baseline; code fixes are local and are not production-resolution claims. Fire-and-forget reliability, legacy pipeline capabilities and versioned Glook-contract migration remain later tasks.

## Research reconciliation

The supplied materials support two opportunity families:

- expressed intent: a person or company explicitly seeks, compares, complains or asks;
- detected commercial problem: the system finds a verifiable gap in website, maps, reviews, hiring, reputation or AI visibility.

Maps and reviews are not automatically buyer intent. They may discover companies, problems and evidence. The product must verify the problem without claiming purchase readiness.

External numbers in the research reports are hypotheses until primary sources, methodology and dates are recorded. The field report “100 messages → 6 replies → 5 interested → 2 purchases” is suitable as a pilot hypothesis, not a general benchmark.

## Immediate stop conditions

- Do not add more source integrations to the current linear pipeline.
- Do not build a generic AI Visibility dashboard.
- Do not expose current route handlers directly as MCP tools.
- Do not continue the root seven-phase plan.
- Do not call an Opportunity “verified buyer intent” merely because a problem and email exist.
