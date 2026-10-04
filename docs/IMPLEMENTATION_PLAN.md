# Opportunity Core and Self-Prospecting Vertical Slice Implementation Plan

**Status:** Accepted 2026-10-04 for staged local implementation. Founder accepted PRODUCT, ROADMAP-V2 and ADR-001–008 without amendments. First pilot is self-prospecting under `EN_DISCOVERY_ONLY`, with contact enrichment and outreach disabled. No production deploy/migration, real outreach, paid API call, billing mutation or provider spend is authorized. The verified-package credit invariant remains in force.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Evolve the existing linear lead pipeline into one durable, evidence-backed self-prospecting Opportunity flow without rewriting the application.

**Architecture:** Add transport-neutral domain/application contracts and Postgres-backed jobs beside the existing pipeline. Wrap current providers, persist Evidence and Opportunity state, project accepted Opportunities into current lead delivery where useful, then add a human review surface and outcome feedback.

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
- The first pilot uses `EN_DISCOVERY_ONLY`: generic contact/draft capabilities may be implemented, but pilot execution must stop before contact enrichment or outreach. A live provider smoke is deferred unless a free/mock-only path proves zero external spend; founder limits above remain binding.
- Before editing a symbol, run GitNexus impact; warn and stop on HIGH/CRITICAL.
- Before any commit, run GitNexus detect-changes and stage files by exact name.

## Review Focus

- Foreign-workspace Glook scan must be denied through every path.
- Worker crash after lease must resume without duplicate Opportunity or charge.
- Provider timeout/rate limit must yield structured partial/retry state within budget.
- Adversarial source text must not inject unsupported claims into assessment or draft.
- Suppressed or invalid contact must never become outreach-ready.

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

- [ ] **Step 1: Pin failing baseline**

Run `npx tsc --noEmit` and confirm the unsafe Supabase mock cast failure in `tests/auth.test.ts`.

- [ ] **Step 2: Restrict Vitest unit discovery**

Configure unit Vitest excludes for `tests/e2e/**`, `tests/integration/**`, `.claude/**`, `.worktrees/**`, `.next/**`, `playwright-report/**` and `test-results/**`. Create a separate integration config whose `include` selects `tests/integration/**/*.test.ts` so the unit exclusion cannot suppress it.

- [ ] **Step 3: Fix the auth mock type**

Create a small typed test factory exposing only the auth method consumed by `requireUser`, and cast through `unknown` only at the helper boundary rather than in each test.

- [ ] **Step 4: Add scripts**

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

- [ ] **Step 5: Verify**

Run `npm run verify`. Expected: app/worker typecheck, 31 current unit tests and Next build pass.

- [ ] **Step 6: Review and commit**

Run `node .gitnexus/run.cjs detect-changes --repo IntentLead`; stage only the listed files explicitly and commit `test: separate deterministic verification scopes`.

### Task 2: Close immediate security and correctness gaps

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

- [ ] **Step 1: Write failing foreign-owner tests**

Cover owner success, foreign user 404/denial, missing scan and not-ready scan for both report and chat warm entry. Also pin current failures for an awaited campaign rate limit, concurrent daily chat quota and missing/empty/wrong/expired/replayed worker signature.

- [ ] **Step 2: Run focused tests**

Run `npx vitest run tests/api/glook-ownership.test.ts`. Expected: foreign-user chat case fails against current helper.

- [ ] **Step 3: Implement owner-bound repository call**

Change the service-role query to include `.eq("user_id", userId)` and an allowed ready status; remove/export no helper that reads by bare scan id.

- [ ] **Step 4: Update callers**

Pass the authenticated user id from every route and map unauthorized/not-found to the same non-enumerating response. Await the campaign limiter. Replace chat read-then-write with one owner-bound atomic quota RPC. Reject worker startup when the secret is missing/empty. Sign each dispatch with method/path/body hash, timestamp and nonce/idempotency key; verify with constant-time comparison, a narrow clock window and persisted replay protection.

- [ ] **Step 5: Verify**

Run the focused API/worker tests, `npm run test:integration -- tests/integration/chat-quota-concurrency.test.ts` (or the integration config's equivalent) and `npm run verify`. Expected: all pass.

- [ ] **Step 6: Security review and commit**

Have a fresh security reviewer inspect Glook call sites, quota concurrency, rate-limit enforcement and worker fail-closed behavior; run GitNexus detect-changes; commit `fix: close immediate authorization and quota gaps`.

### Task 3: Add versioned domain contracts

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

- [ ] **Step 1: Write contract tests**

Test valid parsing plus rejection of missing workspace, missing evidence, confidence outside 0–1, unknown lifecycle state, malformed timestamps and provider payloads leaking into the domain shape.

- [ ] **Step 2: Run focused tests**

Run `npx vitest run tests/domain/contracts.test.ts`. Expected: fail because schemas do not exist.

- [ ] **Step 3: Implement schemas**

Use discriminated unions for signal family, model decision (`QUALIFY/REVIEW/REJECT`), human decision and job state; include `schemaVersion: 1`, jurisdiction, evidence ids, separate assessment dimensions and structured error codes. `VerificationPolicy` declares and versions evidence, company, buyer, contact, grounded-draft, suppression and market/workflow checks used for `PACKAGE_VERIFIED`.

- [ ] **Step 4: Verify**

Run focused tests, typechecks and build.

- [ ] **Step 5: Type-design review and commit**

Fresh reviewer checks illegal states and vendor leakage; run detect-changes; commit `feat: add versioned Opportunity and Evidence contracts`.

### Task 4: Add additive Opportunity and durable-job schema

**Files:**
- Create: `supabase/migrations/202610040001_opportunity_core.sql`
- Create: `supabase/migrations/202610040002_durable_jobs.sql`
- Create: `tests/integration/opportunity-rls.test.ts`
- Create: `tests/integration/job-leases.test.ts`
- Create: `tests/integration/credit-idempotency.test.ts`

**Interfaces:**
- Produces `intentlead_`-prefixed tables for offer/ICP, market profiles, discovery briefs, source items, companies, people, evidence/artifact metadata, opportunities, assessments, buyer candidates, contact points/verifications, verification-policy results, suppression entries, reviews, outcomes, jobs, step attempts, provider runs and cost events; RPCs for atomic enqueue/campaign transition, lease/heartbeat/complete and idempotent verified-package charge.

- [ ] **Step 1: Write real DB tests**

Test clean migration, owner/member/outsider/anonymous access, evidence append-only behavior and legal deletion/tombstone path, artifact linkage, suppression, unique source identity, atomic enqueue rollback/concurrency, one active lease, stale-lease takeover, duplicate completion and concurrent charge under a stored VerificationPolicy version.

- [ ] **Step 2: Run integration tests**

Run the local Supabase integration command. Expected: fail because migrations/RPCs do not exist.

- [ ] **Step 3: Implement additive migrations**

Follow ADR-008: prefix every object/RPC with `intentlead_`; use foreign keys, checks, unique idempotency keys, `FOR UPDATE` or advisory locking where needed, and RLS policies in the same migration set. Every security-definer RPC fixes `search_path`, revokes `PUBLIC EXECUTE`, grants minimum roles and validates tenant/lease identity inside SQL. Do not alter legacy tables destructively.

- [ ] **Step 4: Verify from zero and upgrade**

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
- Create: `worker/providers/contact-enrichment.ts`
- Modify: `worker/pipeline/signals.ts`
- Modify: `worker/pipeline/company.ts`
- Modify: `worker/pipeline/email.ts`
- Create: `tests/providers/*.test.ts`

**Interfaces:**
- Produces `SignalSourceAdapter`, `CompanyResolutionProvider`, `EmailFinderProvider`, `EmailVerificationProvider`, health/status and cost/provenance result envelopes.

- [ ] **Step 1: Create sanitized fixtures and failing contract tests**

For each adapter cover success, empty, malformed, unauthorized, timeout, rate limit and provider-specific uncertain verification.

- [ ] **Step 2: Implement registry**

Resolve capability by MarketProfile, health, policy and cost. Do not call all providers automatically.

- [ ] **Step 3: Wrap legacy functions**

Keep observable behavior for Reddit/HN and current enrichment while returning normalized envelopes and recording provider runs.

- [ ] **Step 4: Add timeout and budget enforcement**

Abort provider requests at configured deadlines; map errors; stop waterfall when confidence requirement is met or budget is exhausted.

- [ ] **Step 5: Verify and commit**

Run provider tests without live keys, full verify, fresh provider/security review and detect-changes; commit `refactor: isolate providers behind capability contracts`.

### Task 7: Build the self-prospecting Opportunity workflow

**Files:**
- Create: `worker/workflows/self-prospecting.ts`
- Create: `lib/domain/opportunity-policy.ts`
- Create: `lib/domain/evidence-policy.ts`
- Create: `lib/ai/schemas/opportunity-assessment.ts`
- Create: `lib/ai/schemas/outreach-draft.ts`
- Modify: `worker/pipeline/runner.ts`
- Modify: `worker/pipeline/message.ts`
- Create: `tests/workflows/self-prospecting.test.ts`
- Create: `tests/evals/opportunity-fixtures.ts`

**Interfaces:**
- Consumes durable jobs, provider registry and domain schema.
- Produces a review-ready Opportunity and optional legacy Lead projection.

- [ ] **Step 1: Write workflow tests**

Cover clear intent, weak signal, wrong company, stale signal, insufficient evidence, provider fallback, contact failure, unsupported draft claim, duplicate rerun and budget exhaustion.

- [ ] **Step 2: Implement deterministic workflow skeleton**

Persist source item/evidence, resolve company, evaluate policy, resolve buyer, enrich/verify contact only after fit/evidence gate, generate grounded draft, and checkpoint each step.

- [ ] **Step 3: Implement bounded reasoning schemas**

Model outputs return only schema fields and evidence ids. Reject unknown evidence references and factual sentences without support.

- [ ] **Step 4: Add legacy projection**

For a policy-qualified, verified package, populate the current delivery shape without changing Opportunity semantics or charging twice. Do not confuse model `QUALIFY`, human `ACCEPT` and the `PACKAGE_VERIFIED` credit event.

- [ ] **Step 5: Verify and commit**

Run workflow/eval/provider/DB tests, full verify, AI/security review and detect-changes; commit `feat: deliver evidence-backed self-prospecting opportunities`.

### Task 8: Add human review and outcome UI

**Files:**
- Create: `app/workspace/opportunities/page.tsx`
- Create: `app/workspace/opportunities/[id]/page.tsx`
- Create: `components/opportunities/OpportunityCard.tsx`
- Create: `components/opportunities/EvidencePanel.tsx`
- Create: `components/opportunities/ReviewControls.tsx`
- Create: `app/api/opportunities/route.ts`
- Create: `app/api/opportunities/[id]/route.ts`
- Create: `app/api/opportunities/[id]/review/route.ts`
- Create: `app/api/opportunities/[id]/outcome/route.ts`
- Create: `tests/e2e/opportunity-review.spec.ts`

**Interfaces:**
- Consumes application capability services only.
- Produces paginated list/detail, evidence inspection, review decision and outcome recording.

- [ ] **Step 1: Write API authorization and component state tests**

Cover owner/member/outsider, pagination, loading, empty, partial, error/retry, missing evidence, suppression and stale Opportunity.

- [ ] **Step 2: Implement server routes and pages**

Use authenticated application context; no direct service-role reads in components/routes. Facts and interpretations have distinct labels. Display source, captured time, confidence and limitations.

- [ ] **Step 3: Implement review/outcome commands**

Require a rejection reason, idempotency key and deterministic state transition. Sending remains copy/mailto/manual.

- [ ] **Step 4: Implement Playwright journey**

Seed a workspace/job/Opportunity; inspect evidence; reject one; accept one; copy draft; record sent and positive reply; assert keyboard/mobile behavior.

- [ ] **Step 5: Verify and commit**

Run unit/API/Playwright/build, fresh frontend/a11y/security review and detect-changes; commit `feat: add Opportunity review and outcome workflow`.

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

## Self-review

- Spec coverage: governance, full domain contracts, namespace/RPC security, durable jobs, provider abstraction, Glook boundary, dogfood, review/outcomes, backend/front-end/security/AI tests and release evidence are mapped to Tasks 0–10.
- Placeholder scan: the plan contains no implementation placeholder; later product phases remain in ROADMAP-V2 rather than this milestone.
- Type consistency: Tasks 3–9 consume the same versioned contracts and application context.
- Review focus: each focus risk has an explicit test owner in Tasks 2, 4, 5, 7, 8 or 9.
