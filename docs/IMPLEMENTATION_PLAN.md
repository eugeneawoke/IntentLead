# Opportunity Core and Self-Prospecting Vertical Slice Implementation Plan

**Status:** Accepted 2026-10-04 for staged local implementation. Founder accepted PRODUCT, ROADMAP-V2 and ADR-001–008 without amendments. First pilot is self-prospecting under `EN_DISCOVERY_ONLY`, with contact enrichment and outreach disabled. No production deploy/migration, real outreach, paid API call, billing mutation or provider spend is authorized. The verified-package credit invariant remains in force.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing linear lead pipeline into one durable, evidence-backed self-prospecting Opportunity flow without rewriting the application.

**Architecture:** Add transport-neutral domain/application contracts and Postgres-backed jobs beside the existing pipeline. Wrap discovery and company-resolution providers, persist Evidence and Opportunity state, then add a human review surface. Contact-bearing Lead projection, drafting and sent/reply feedback require a separately authorized jurisdiction-gated workflow.

**Tech Stack:** Next.js 15.5.x, React 19, TypeScript strict, Supabase/PostgreSQL/RLS, Railway Node worker, Zod, Vitest, Playwright.

**Spec:** `docs/PRODUCT.md`, `docs/DOMAIN_MODEL.md`, `docs/ARCHITECTURE.md`, ADR-001 through ADR-008.

## Global Constraints

- Preserve current working UI/API while the new flow is introduced.
- Every tenant table has RLS and negative cross-tenant tests.
- Service role remains server/worker-only and never substitutes for authorization.
- Charging is atomic, owner-validated and idempotent; machine-rejected/failed/duplicate work is not charged. The current verified-package trigger remains until a separate commercial decision changes it.
- External/provider/model content is untrusted and validated through versioned schemas.
- Factual outreach claims require evidence references.
- No autonomous sending, new source expansion or full AI Visibility module in this milestone.
- The first pilot and this milestone use `EN_DISCOVERY_ONLY`: the profile gate must stop workflow and application capabilities before contact/people lookup, email finding or verification, draft generation, outreach-ready transition, sent/reply recording or `PACKAGE_VERIFIED` charging. Generic contracts may exist for later work, but these capabilities are not executed or exposed in this slice. Add negative workflow/API/UI tests. A live provider smoke is deferred unless a free/mock-only path proves zero external spend; founder limits above remain binding.
- Before editing a symbol, run GitNexus impact; warn and stop on HIGH/CRITICAL.
- Before any commit, run GitNexus detect-changes and stage files by exact name.

## Review Focus

- Foreign-workspace Glook scan must be denied through every path.
- Worker crash after lease must resume without duplicate Opportunity or charge.
- Provider timeout/rate limit must yield structured partial/retry state within budget.
- Adversarial source text must not inject unsupported claims into assessment; a later draft workflow needs its own evidence-claim gate.
- `EN_DISCOVERY_ONLY` must deny contact lookup, drafting, outreach-ready state and sent/reply outcome even after a positive assessment or human acceptance.

---

### Task 0: Accept governance and reconcile active instructions

**Files:**
- Modify only after founder acceptance: `AGENTS.md`, `CLAUDE.md`, relevant root source-of-truth documents
- Verify: `docs/INDEX.md`, proposed ADRs and this plan

**Interfaces:**
- Produces one unambiguous instruction hierarchy and accepted/rejected/amended status for every proposed ADR.

- [x] **Step 1: Founder decision (2026-10-04)**

Record acceptance or amendments for the product boundary, first pilot, ROADMAP-V2, ADR-001 through ADR-008 and the verified-package charging invariant.

- [x] **Step 2: Reconcile active agent instructions (2026-10-04)**

Update active instructions and root document pointers so they no longer require an obsolete phase/domain model. Preserve historical rationale and protected-file policy.

- [x] **Step 3: Verify governance (2026-10-04)**

Confirm there is no conflict in source-of-truth order, credit semantics, roadmap, current framework version or implementation-plan path. Do not begin Task 1 until this passes.

### Task 1: Separate and stabilize verification commands

**Local status, 2026-10-04: complete.** Commits `2d53047` and `a929515` added separate verification scopes and corrected empty integration discovery. `npm run verify` passed with app/worker typechecks, lint, 31 unit tests and the Next production build. Until real integration tests exist, `npm run test:integration` intentionally exits 1 with “No test files found”; integration is not part of `verify`.

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.integration.config.ts`
- Create: `eslint.config.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/auth.test.ts`
- Create: `tests/integration/.gitkeep`

**Interfaces:**
- Produces scripts `typecheck:app`, `typecheck:worker`, `test:unit`, `test:integration`, `verify`.

- [x] **Step 1: Pin failing baseline**

Run `npx tsc --noEmit` and confirm the unsafe Supabase mock cast failure in `tests/auth.test.ts`.

- [x] **Step 2: Restrict Vitest unit discovery**

Configure unit Vitest excludes for `tests/e2e/**`, `tests/integration/**`, `.claude/**`, `.worktrees/**`, `.next/**`, `playwright-report/**` and `test-results/**`. Create a separate integration config whose `include` selects `tests/integration/**/*.test.ts` so the unit exclusion cannot suppress it.

- [x] **Step 3: Fix the auth mock type**

Create a small typed test factory exposing only the auth method consumed by `requireUser`, and cast through `unknown` only at the helper boundary rather than in each test.

- [x] **Step 4: Add scripts**

Add Zod as a direct dependency and scripts equivalent to:

```json
{
  "typecheck:app": "tsc --noEmit",
  "typecheck:worker": "tsc -p worker/tsconfig.json --noEmit",
  "lint": "eslint .",
  "test:unit": "vitest run --config vitest.config.ts",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "verify": "npm run typecheck:app && npm run typecheck:worker && npm run lint && npm run test:unit && npm run build"
}
```

- [x] **Step 5: Verify**

Run `npm run verify`. Expected: app/worker typecheck, 31 current unit tests and Next build pass.

- [x] **Step 6: Review and commit**

Run `node .gitnexus/run.cjs detect-changes --repo IntentLead`; stage only the listed files explicitly and commit `test: separate deterministic verification scopes`.

### Task 2: Close immediate security and correctness gaps

**Local status, 2026-10-04: complete.** Review-fix `npm run verify` passes (68 tests, app/worker types, lint with 24 pre-existing warnings, Next build); the focused suite passes 37 tests. Fresh security review findings were addressed with post-insert nonce freshness validation, restricted workspace columns, and representative default-grant DB fixtures. The earlier unavailable-runtime blocker is superseded: all **31/31 real PostgreSQL integration tests passed** in a disposable local `postgres:16-alpine` container (8.23 seconds), including quota concurrency and delayed replay versus expiry cleanup. The container was removed afterward. No remote or production migration/deployment occurred.

**Files:**
- Modify: `lib/glook/report.ts`
- Modify: `app/api/glook/report/[scanId]/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/campaigns/route.ts`
- Modify: `lib/auth/dispatchToWorker.ts`
- Modify: `worker/index.ts`
- Create: `supabase/migrations/202610040000_atomic_chat_quota.sql`
- Create: `tests/api/glook-ownership.test.ts`
- Create: `tests/api/rate-limit-enforcement.test.ts`
- Create: `tests/integration/chat-quota-concurrency.test.ts`
- Create: `tests/worker/authentication.test.ts`

**Interfaces:**
- Produces `getOwnedGlookContext(input: { scanId: string; userId: string }): Promise<GlookScanContext | null>`, enforced campaign limits, atomic chat quota and fail-closed timestamped HMAC worker authentication with nonce/idempotency replay protection.

- [x] **Step 1: Write failing foreign-owner tests**

Cover owner success, foreign user 404/denial, missing scan and not-ready scan for both report and chat warm entry. Also pin current failures for an awaited campaign rate limit, concurrent daily chat quota and missing/empty/wrong/expired/replayed worker signature.

Tests were written and the API failures were observed before implementation; the missing-secret bypass was also reproduced against the baseline. The pre-implementation DB run was blocked by local prerequisites; after that blocker was cleared, the final 31-case real PostgreSQL suite passed on 2026-10-04. This final GREEN does not retroactively claim a DB baseline RED.

- [x] **Step 2: Run focused tests**

Run `npx vitest run tests/api/glook-ownership.test.ts`. Expected: foreign-user chat case fails against current helper.

- [x] **Step 3: Implement owner-bound repository call**

Change the service-role query to include `.eq("user_id", userId)` and an allowed ready status; remove/export no helper that reads by bare scan id.

- [x] **Step 4: Update callers**

Pass the authenticated user id from every route and map unauthorized/not-found to the same non-enumerating response. Await the campaign limiter. Replace chat read-then-write with one owner-bound atomic quota RPC. Reject worker startup when the secret is missing/empty. Sign each dispatch with method/path/body hash, timestamp and nonce/idempotency key; verify with constant-time comparison, a narrow clock window and persisted replay protection.

- [x] **Step 5: Verify**

Run the focused API/worker tests, `npm run test:integration -- tests/integration/chat-quota-concurrency.test.ts` (or the integration config's equivalent) and `npm run verify`. Expected: all pass.

Evidence, 2026-10-04: 37 focused tests, 68 full deterministic tests/build, and 31/31 real PostgreSQL tests pass. The local migration and privilege fixtures executed only in the disposable container, which was removed after verification.

- [x] **Step 6: Security review and commit**

Have a fresh security reviewer inspect Glook call sites, quota concurrency, rate-limit enforcement and worker fail-closed behavior; run GitNexus detect-changes; commit `fix: close immediate authorization and quota gaps`.

Completed with implementation commit `786824e` and security-review fix commit `5210057`; GitNexus scope and exact staged files were reviewed before each commit. Local Task 2 completion does not authorize a production release.

### Task 3: Add versioned domain contracts

**Local status, 2026-10-04: complete; independent type-design re-review clean.** Added strict version-1 schemas and inferred types for all requested contracts, including separate model/human/job discriminants, explicit discovery-only policy denies and versioned seven-check package verification records. Contract tests captured the initial missing-module RED before implementation. Two review fix rounds closed the normalized fact vocabulary, required state-dependent Opportunity references (including both references for MODEL_REJECTED) and tightened intrinsic Job chronology against snapshot updates; implementation and fixes are committed as `e10b211`, `9877fd0` and `525d857`. Final verification passed: 222 contract tests, 290 unit tests, app/worker typechecks, focused lint and the production build (existing unrelated lint warnings remain). Production runtime, providers and database behavior are unchanged.

**Files:**
- Create: `types/evidence.ts`
- Create: `types/opportunity.ts`
- Create: `types/job.ts`
- Create: `types/source-item.ts`
- Create: `types/person.ts`
- Create: `types/contact.ts`
- Create: `types/market-profile.ts`
- Create: `types/discovery-brief.ts`
- Create: `types/review-outcome.ts`
- Create: `types/suppression.ts`
- Create: `types/artifact.ts`
- Create: `types/verification-policy.ts`
- Create: `lib/domain/schemas/evidence.ts`
- Create: `lib/domain/schemas/opportunity.ts`
- Create: `lib/domain/schemas/job.ts`
- Create: `tests/domain/contracts.test.ts`

**Interfaces:**
- Produces Zod schemas and inferred types for `SourceItem`, `EvidenceItem`, `OpportunityAssessment`, `Opportunity`, `Job`, `Person`, `BuyerCandidate`, `ContactPoint`, `ContactVerification`, `VerificationPolicy`, `MarketProfile`, `DiscoveryBrief`, `ReviewDecision`, `Outcome`, `SuppressionEntry`, `ArtifactMetadata` and provider-independent `CapabilityError`.

- [x] **Step 1: Write contract tests**

Test valid parsing plus rejection of missing workspace, missing evidence, confidence outside 0–1, unknown lifecycle state, malformed timestamps and provider payloads leaking into the domain shape.

- [x] **Step 2: Run focused tests**

Run `npx vitest run tests/domain/contracts.test.ts`. Expected: fail because schemas do not exist.

- [x] **Step 3: Implement schemas**

Use discriminated unions for signal family, model decision (`QUALIFY/REVIEW/REJECT`), human decision and job state; include `schemaVersion: 1`, jurisdiction, evidence ids, separate assessment dimensions and structured error codes. `VerificationPolicy` declares and versions evidence, company, buyer, contact, grounded-draft, suppression and market/workflow checks used for `PACKAGE_VERIFIED`.

- [x] **Step 4: Verify**

Run focused tests, typechecks and build.

- [x] **Step 5: Type-design review and commit**

Fresh reviewer checks illegal states and vendor leakage; run detect-changes; commit `feat: add versioned Opportunity and Evidence contracts`.

### Task 4: Add additive Opportunity and durable-job schema

**Local implementation status, 2026-10-04: review fix round 1 complete; awaiting independent re-review.** The additive prefixed schema, durable-job RPCs and idempotent verified-package charge are implemented locally. Review hardening now derives billing eligibility from the locked Opportunity → DiscoveryBrief → MarketProfile chain, persists all seven VerificationPolicy checks through typed tenant-bound relations, removes direct service-role mutation of Task 4 tables, terminalizes exhausted leases, fingerprints exact completion replay, and performs shared-reference-safe graph tombstoning. Mandatory RED was captured for the original implementation and for the adversarial review cases. On a fresh populated-baseline PostgreSQL 16 database, all 21 Task 4 integration tests passed twice on the same database; the existing 31-test quota/replay suite passed separately. App/worker typechecks, 290 unit tests, full lint and the production build pass (24 pre-existing lint warnings remain). No remote migration, provider call, outreach or real charge occurred. Partial-migration crash recovery is not claimed: the migrations are transactional, and verification covers clean bootstrap plus additive upgrade from a populated supported baseline, not recovery from manually committed fragments.

**Files:**
- Create: `supabase/migrations/202610040001_opportunity_core.sql`
- Create: `supabase/migrations/202610040002_durable_jobs.sql`
- Create: `tests/integration/opportunity-rls.test.ts`
- Create: `tests/integration/job-leases.test.ts`
- Create: `tests/integration/credit-idempotency.test.ts`

**Interfaces:**
- Produces `intentlead_`-prefixed tables for offer/ICP, market profiles, discovery briefs, source items, companies, people, evidence/artifact metadata, opportunities, assessments, buyer candidates, contact points/verifications, verification-policy results, suppression entries, reviews, outcomes, jobs, step attempts, provider runs and cost events; RPCs for atomic enqueue/campaign transition, lease/heartbeat/complete and idempotent verified-package charge.

- [x] **Step 1: Write real DB tests**

Test clean migration, owner/member/outsider/anonymous access, evidence append-only behavior and legal deletion/tombstone path, artifact linkage, suppression, unique source identity, atomic enqueue rollback/concurrency, one active lease, stale-lease takeover, duplicate completion and concurrent charge under a stored VerificationPolicy version.

- [x] **Step 2: Run integration tests**

Run the local Supabase integration command. Expected: fail because migrations/RPCs do not exist.

- [x] **Step 3: Implement additive migrations**

Follow ADR-008: prefix every object/RPC with `intentlead_`; use foreign keys, checks, unique idempotency keys, `FOR UPDATE` or advisory locking where needed, and RLS policies in the same migration set. Every security-definer RPC fixes `search_path`, revokes `PUBLIC EXECUTE`, grants minimum roles and validates tenant/lease identity inside SQL. Do not alter legacy tables destructively.

- [x] **Step 4: Verify from zero and upgrade**

Recreate a disposable database, apply all migrations, run all three integration files twice and verify no duplicate rows/charges.

- [ ] **Step 5: DB/security review and commit**

Fresh reviewers inspect ownership joins, service-role assumptions, indexes and rollback/compensation; run detect-changes; commit `feat: add Opportunity Core and durable job schema`.

### Task 5: Implement application services and job runtime

**Files:**
- Create: `lib/application/context.ts`
- Create: `lib/application/errors.ts`
- Create: `lib/application/opportunities.ts`
- Create: `lib/application/data-lifecycle.ts`
- Create: `worker/jobs/repository.ts`
- Create: `worker/jobs/worker.ts`
- Modify: `app/api/campaigns/[id]/run/route.ts`
- Modify: `lib/auth/dispatchToWorker.ts`
- Modify: `worker/index.ts`
- Create: `tests/integration/job-recovery.test.ts`
- Create: `tests/integration/data-deletion.test.ts`

**Interfaces:**
- Consumes Task 3 schemas and Task 4 RPCs.
- Produces `startOpportunitySearch(ctx, input) -> { jobId }` and worker lease loop.

- [ ] **Step 1: Write failing job acceptance/recovery tests**

Cover durable row before 202, missing worker configuration, duplicate idempotency key, lost wake-up recovered by polling, crash after lease, expired lease recovery, poison/dead-letter exhaustion, graceful shutdown and cancellation during an external call.

- [ ] **Step 2: Implement application context**

Context contains authenticated user, server-derived workspace membership, trace id, permissions and budget. No capability accepts workspace authority from request body.

Resolve the workspace's authorized MarketProfile in application context and return a structured policy denial before any disabled capability selects a provider or changes state. `EN_DISCOVERY_ONLY` permits discovery and review; it does not grant contact, draft, outreach, sent/reply or verified-package charging capabilities.

Implement an owner-authorized relational deletion workflow covering this milestone's source, evidence, contact, opportunity, provider and job records while retaining only policy-required suppression tombstones. Do not persist live object artifacts, embeddings or evaluation copies until deletion adapters exist; document supported backup expiry.

- [ ] **Step 3: Implement job repository and worker loop**

Lease atomically, heartbeat, checkpoint, map retryable/permanent errors and complete with `COMPLETED`, `PARTIAL` or `FAILED`. Define independent polling with backoff/jitter, graceful shutdown, global and per-provider concurrency, dead-letter policy, lease-token validation and cancellation between/around external calls.

- [ ] **Step 4: Replace fire-and-forget acceptance**

The run route creates the job and campaign-state transition in one transaction and returns `{jobId,status:"queued"}`. HTTP dispatch becomes a wake-up hint; independent polling/recovery is the source of liveness.

- [ ] **Step 5: Verify and commit**

Run focused job and deletion integration tests, `npm run verify`, fresh reliability/data-governance review and detect-changes; commit `feat: make pipeline execution durable and idempotent`.

### Task 6: Wrap current providers and persist provenance/cost

**Files:**
- Create: `worker/providers/contracts.ts`
- Create: `worker/providers/registry.ts`
- Create: `worker/providers/reddit.ts`
- Create: `worker/providers/hackernews.ts`
- Create: `worker/providers/company-resolution.ts`
- Modify: `worker/pipeline/signals.ts`
- Modify: `worker/pipeline/company.ts`
- Create: `tests/providers/*.test.ts`

**Interfaces:**
- Produces `SignalSourceAdapter`, `CompanyResolutionProvider`, health/status and cost/provenance result envelopes. Contact/email provider adapters belong to a separately authorized jurisdiction-gated workflow.

- [ ] **Step 1: Create sanitized fixtures and failing contract tests**

For each permitted discovery/company adapter cover success, empty, malformed, unauthorized, timeout, rate limit and uncertain entity resolution.

- [ ] **Step 2: Implement registry**

Resolve capability by MarketProfile, health, policy and cost. Do not call all providers automatically.

- [ ] **Step 3: Wrap legacy functions**

Keep observable discovery and company-resolution behavior for Reddit/HN and Exa/Serper while returning normalized envelopes and recording provider runs. Do not invoke legacy contact/email enrichment in `EN_DISCOVERY_ONLY`.

- [ ] **Step 4: Add timeout and budget enforcement**

Abort permitted discovery/company-resolution requests at configured deadlines; map errors and stop at the cost budget. Reject contact/email capability selection under `EN_DISCOVERY_ONLY` before any provider call.

- [ ] **Step 5: Verify and commit**

Run provider tests without live keys, full verify, fresh provider/security review and detect-changes; commit `refactor: isolate providers behind capability contracts`.

### Task 7: Build the self-prospecting Opportunity workflow

**Files:**
- Create: `worker/workflows/self-prospecting.ts`
- Create: `lib/domain/opportunity-policy.ts`
- Create: `lib/domain/evidence-policy.ts`
- Create: `lib/ai/schemas/opportunity-assessment.ts`
- Modify: `worker/pipeline/runner.ts`
- Create: `tests/workflows/self-prospecting.test.ts`
- Create: `tests/evals/opportunity-fixtures.ts`

**Interfaces:**
- Consumes durable jobs, provider registry and domain schema.
- Produces an evidence-backed Opportunity eligible for human review. It does not produce a contact-bearing Lead projection or verified-package charge under `EN_DISCOVERY_ONLY`.

- [ ] **Step 1: Write workflow tests**

Cover clear intent, weak signal, wrong company, stale signal, insufficient evidence, permitted company-provider fallback, duplicate rerun and budget exhaustion. Add negative tests proving `EN_DISCOVERY_ONLY` never calls contact/people search, email find/verify, message/draft generation or the credit RPC, and never reaches outreach-ready or sent/reply states, even after model `QUALIFY` or human `ACCEPT`.

- [ ] **Step 2: Implement deterministic workflow skeleton**

Persist source item/evidence, resolve company, evaluate Opportunity policy and checkpoint each step. Resolve the authorized MarketProfile before dispatch; for `EN_DISCOVERY_ONLY`, end at human-review eligibility and return a policy-denied result for downstream contact/draft/outreach capabilities before selecting a provider. A buyer-role hypothesis may be recorded without identifying or contacting a person.

- [ ] **Step 3: Implement bounded reasoning schemas**

Model assessment outputs return only schema fields and evidence ids. Reject unknown evidence references and unsupported factual claims in the Opportunity assessment. Outreach-draft schemas and tests belong to the later authorized workflow.

- [ ] **Step 4: Enforce the pilot projection and credit boundary**

Project only non-contact Opportunity data needed for review. Do not populate a contact-bearing legacy Lead, emit `PACKAGE_VERIFIED` or call the credit RPC under `EN_DISCOVERY_ONLY`. Test that model `QUALIFY` and human `ACCEPT` do not bypass this gate. The legacy Lead projection and verified-package charge are separately authorized later work.

- [ ] **Step 5: Verify and commit**

Run workflow/eval/provider/DB tests, full verify, AI/security review and detect-changes; commit `feat: deliver evidence-backed self-prospecting opportunities`.

### Task 8: Add human Opportunity review UI

**Files:**
- Create: `app/workspace/opportunities/page.tsx`
- Create: `app/workspace/opportunities/[id]/page.tsx`
- Create: `components/opportunities/OpportunityCard.tsx`
- Create: `components/opportunities/EvidencePanel.tsx`
- Create: `components/opportunities/ReviewControls.tsx`
- Create: `app/api/opportunities/route.ts`
- Create: `app/api/opportunities/[id]/route.ts`
- Create: `app/api/opportunities/[id]/review/route.ts`
- Create: `tests/api/opportunities-review.test.ts`
- Create: `tests/e2e/opportunity-review.spec.ts`

**Interfaces:**
- Consumes application capability services only.
- Produces paginated list/detail, evidence inspection and human `ACCEPT/REJECT/NEEDS_RESEARCH` review decisions. Contact details, drafts, outreach controls and sent/reply outcomes are absent for `EN_DISCOVERY_ONLY`.

- [ ] **Step 1: Write API authorization and component state tests**

Cover owner/member/outsider, pagination, loading, empty, partial, error/retry, missing evidence and stale Opportunity. Add negative API/component tests: review payloads cannot set contact, draft, outreach-ready or sent/reply state; list/detail omit contact/draft fields; review `ACCEPT` does not unlock those capabilities. Existing legacy downstream routes, if any, must return policy denial for this profile.

- [ ] **Step 2: Implement server routes and pages**

Use authenticated application context; no direct service-role reads in components/routes. Facts and interpretations have distinct labels. Display source, captured time, confidence and limitations.

- [ ] **Step 3: Implement review commands**

Require a rejection reason, idempotency key and deterministic review transition. Only `ACCEPT`, `REJECT` and `NEEDS_RESEARCH` are available in this slice. Do not add a sent/reply outcome route, copy/mailto control or other outreach action.

- [ ] **Step 4: Implement Playwright journey**

Seed an `EN_DISCOVERY_ONLY` workspace/job/Opportunity; inspect evidence; reject one; accept one; mark one `NEEDS_RESEARCH`; assert keyboard/mobile behavior. Assert no contact details, draft, copy/mailto/export-for-outreach, sent/reply action or credit charge appears. Direct requests to existing downstream routes must be policy-denied; an unimplemented route must remain absent.

- [ ] **Step 5: Verify and commit**

Run unit/API/Playwright/build, fresh frontend/a11y/security review and detect-changes; commit `feat: add discovery-only Opportunity review`.

### Task 9: Replace direct Glook reads with a versioned contract

**Files:**
- Create: `types/glook-site-context-snapshot.ts`
- Modify: `lib/glook/report.ts`
- Create: `lib/glook/import-snapshot.ts`
- Create: `tests/contracts/glook-snapshot.test.ts`
- Coordinate exact export/event files in the Glook repository through its own approved plan

**Interfaces:**
- Produces versioned `SiteContextSnapshot` export/import with authenticated tenant binding and idempotent provenance.

- [ ] **Step 1: Contract test both sides**

Freeze compatible producer/consumer fixtures for valid, foreign-owner, malformed, stale, redacted and unknown-version snapshots.

- [ ] **Step 2: Implement export/import and shadow comparison**

Add authenticated export or signed event in Glook and idempotent SourceItem/Evidence import in IntentLead. Shadow-compare with the temporary owner-bound direct read.

- [ ] **Step 3: Remove direct reads**

After parity and rollback window, prove zero runtime call sites read Glook internal tables. This task is mandatory before a Glook-dependent production pilot, AI Visibility build or public MCP release.

- [ ] **Step 4: Verify and commit**

Run contract, authz, import-idempotency and full verification in both repositories; obtain fresh security review and commit through each repository's policy.

### Task 10: Release gate and dogfood run

**Files:**
- Modify: `docs/CURRENT_STATE_AUDIT.md`
- Modify: `docs/IMPLEMENTATION_BACKLOG.md`
- Create: `docs/releases/opportunity-core-dogfood.md`

**Interfaces:**
- Produces the milestone evidence packet and go/no-go decision.

- [ ] **Step 1: Run complete verification**

Run typechecks, lint, unit, DB integration, provider contracts, AI evaluation, Playwright and production build.

- [ ] **Step 2: Run security verification**

Execute Glook IDOR, RLS, replay, SSRF, injection, CSV, suppression and log-redaction cases; record results.

Run the owner-authorized deletion journey and prove all relational data created by the dogfood workflow is removed or policy-tombstoned. Confirm no live object artifacts, embeddings or evaluation copies were created; record the documented backup-expiry boundary.

- [ ] **Step 3: Run one controlled dogfood job within authorization**

Use the approved ICP and sanitized fixtures for a no-spend discovery-only run. Do not enrich contacts or contact anyone. Save redacted trace, evidence package, zero-spend cost record and human review labels. A live provider call remains pending until a free/mock-only path proves zero external spend or the founder separately authorizes it.

- [ ] **Step 4: Independent whole-branch review**

Fresh reviewers assess domain correctness, DB/security, AI evaluation and front-end journey. Resolve blockers through the owning implementer.

- [ ] **Step 5: Decide**

Record GO for a larger dogfood sample, REWORK with measured gaps, or STOP with kill criteria. Update canonical audit/backlog and commit only approved source/release documentation under repository policy.

## Deferred: jurisdiction-gated contact, draft and outcome workflow

This is not a Task 0–10 deliverable and must not run under `EN_DISCOVERY_ONLY`. Start a separate implementation plan only after the founder selects a country/jurisdiction-specific MarketProfile, approves the legal/retention/outreach policy and provider access, and authorizes any live spend or contact. That plan owns `worker/providers/contact-enrichment.ts`, `worker/pipeline/email.ts`, `lib/ai/schemas/outreach-draft.ts`, `worker/pipeline/message.ts`, a contact-bearing Lead projection and `app/api/opportunities/[id]/outcome/route.ts` if still appropriate.

The later workflow must independently test buyer/contact resolution, email verification, evidence-grounded draft claims, suppression, owner-validated idempotent `PACKAGE_VERIFIED` charging, human-approved manual sending and sent/reply outcomes. Until then, the `EN_DISCOVERY_ONLY` profile gate and its negative tests are the release boundary.

## Self-review

- Spec coverage: governance, full domain contracts, namespace/RPC security, durable jobs, discovery/company provider abstraction, Glook boundary, discovery-only dogfood and review, backend/front-end/security/AI tests and release evidence are mapped to Tasks 0–10. Contact/draft/outreach/outcome execution is a separate later workflow.
- Placeholder scan: the plan contains no implementation placeholder; later product phases remain in ROADMAP-V2 rather than this milestone.
- Type consistency: Tasks 3–9 consume the same versioned contracts and application context.
- Review focus: each focus risk has an explicit test owner in Tasks 2, 4, 5, 7, 8 or 9.
