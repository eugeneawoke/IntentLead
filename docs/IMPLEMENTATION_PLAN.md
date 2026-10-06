# Opportunity Core implementation plan

**Status:** Active, revised 2026-10-06.

## Goal

Deliver a runnable, zero-spend self-prospecting workflow that produces evidence-backed Opportunities for human review, while removing the old lead/email/outreach product from active code and documentation.

## Constraints

- local implementation only; no production deploy or migration;
- no paid API calls or provider spend;
- no personal-contact enrichment;
- no message sending, mailbox integration, sequences or delivery tracking;
- no Glook, website-audit or AI Visibility dependency;
- GitNexus impact before symbol edits and detect-changes before commits;
- backend, database, frontend and independent review gates remain mandatory.

## Verified baseline

The previous Task 0–8 work established verification commands, security fixes, versioned Opportunity contracts, additive Opportunity/job schema, durable runtime, provider registry/provenance, discovery-only workflow and human review UI. Those commits remain implementation evidence in Git; their obsolete Lead/outreach migration assumptions are not the active plan.

The Glook snapshot consumer commits `14097c4` and `3251300` are a dormant optional adapter. Glook producer work is no longer on the critical path. Active direct-table reads still must be removed as security/ownership debt.

## Task A — Canonical reset and legacy inventory

- [x] Rewrite active product, domain, architecture, roadmap, capability and execution documents (2026-10-06).
- [x] Remove obsolete root product/spec/stack documents from the active repository; Git retains history (2026-10-06).
- [x] Remove committed AI Visibility and verified-package credit ADRs from active decisions (2026-10-06).
- [x] Update agent instructions and design language so old terminology cannot re-enter implementation (2026-10-06).
- [x] Verify internal links and scan active docs for conflicting target semantics (2026-10-06).

**Done when:** active documentation contains one Opportunity Intelligence model and a forward-only execution path.

## Task B — Remove immediately isolated legacy runtime

- [x] Re-index GitNexus and confirm impact for every removed symbol (2026-10-06).
- [x] Add negative route/UI tests for retired lead export, lead delivery and message-generation surfaces (2026-10-06).
- [x] Remove the unused linear worker pipeline and its provider wrappers/tests (`523939b`).
- [x] Remove legacy lead API/export, lead cards/dashboard and message-generation code (`523939b`).
- [x] Remove active Glook direct reads and warm-chat coupling; retain only the dormant versioned adapter with no runtime route (`92571ce`).
- [x] Remove or replace public copy, pricing, comparison, methodology and roadmap claims based on verified leads, email waterfall, reply rate or sending (`92571ce`).
- [x] Run focused tests, full `npm run verify` and retired-route browser smoke tests: 526 unit and 9/9 smoke checks passed (2026-10-06).

**Done:** no reachable UI/API/worker path exposes the old lead/email/message product. Applied historical migrations and schema compatibility objects remain isolated debt for Task E.

## Task C — Native discovery authority

- [x] Add native OfferProfile and ICPDefinition persistence/contracts (`202610060016_native_discovery_authority.sql`).
- [x] Make DiscoveryBrief the authority for create/list/context/enqueue/lifecycle/deletion (2026-10-06).
- [x] Change application context and start commands from `campaignId` to `discoveryBriefId`; retire `/api/campaigns` (2026-10-06).
- [x] Remove active legacy campaign synchronization and add cross-tenant/concurrency/deletion tests (2026-10-06).
- [x] Keep applied migrations immutable; add a forward-only migration and verify it against the populated upgrade fixture in disposable PostgreSQL (4/4 Task C integration tests pass).

**Done:** native Opportunity execution does not read or write legacy campaign semantics. Historical bridge objects remain isolated for Task E reconciliation and removal.

## Task D — Runnable zero-spend self-prospecting

- [x] Wire `createSelfProspectingHandler` into the worker through explicit dependency injection (2026-10-06).
- [x] Add a fixture/no-network provider set with `maxTotalCost = 0` and fail-closed network guards (2026-10-06).
- [x] Run discovery → evidence → company → assessment → review end to end (2026-10-06).
- [x] Prove idempotent rerun, recovery, cancellation, tenant denial and zero personal/contact/message data (2026-10-06).
- [x] Add the browser journey for an explicitly synthetic contract fixture and human review (2026-10-06). A recorded authorized sample remains a separate Task F gate.

**Done:** explicit fixture mode produces a reviewable Opportunity instead of `CAPABILITY_UNAVAILABLE`, with zero spend and no legacy downstream action. Its Acme data is synthetic and carries `SYNTHETIC_CONTRACT_FIXTURE`; it is not evidence for the later authorized-sample quality gate. `disabled` remains the default; live mode is unavailable. Full verify, browser and per-file isolated PostgreSQL evidence is recorded in `CURRENT_STATE_AUDIT.md`.

## Task E — Remove legacy schema bridge

- [ ] Reconcile local legacy rows needed for tests.
- [ ] Remove `legacy_campaign_id`, old helper RPCs and remaining foreign-key dependencies.
- [ ] Add an additive cleanup migration for obsolete `campaigns`, `signals`, `leads`, `messages` and old credit functions.
- [ ] Verify clean database, upgrade database, RLS, deletion and rollback strategy in disposable PostgreSQL.

**Done when:** new execution and tests have no dependency on old product tables or verified-contact credit semantics.

## Task F — Dogfood quality gate

- [ ] Run the full backend/frontend/database/security/evaluation suite.
- [ ] Run one controlled self-prospecting sample on recorded authorized evidence.
- [ ] Record acceptance, rejection reasons, company accuracy, evidence sufficiency, duplicates, latency and zero-spend cost.
- [ ] Obtain independent domain, security and frontend reviews; resolve blockers.
- [ ] Decide GO, REWORK or STOP for a larger sample.

**Done when:** the result is a measured Opportunity-quality decision, not a demonstration of infrastructure.

## Following milestone

After a successful dogfood gate, increase sample size and calibrate quality. AI Visibility and personal-contact/message workflows require a new product decision. Technical, SEO and AI-readiness website auditing is outside the accepted product scope.
