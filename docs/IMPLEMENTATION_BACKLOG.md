# Implementation backlog

Backlog status: derived from ROADMAP-V2 on 2026-10-04. Tasks are ordered; later epics must not bypass earlier gates.

Governance status: PRODUCT, ROADMAP-V2 and ADR-001–008 accepted on 2026-10-04. The first pilot uses `EN_DISCOVERY_ONLY`; contact enrichment and outreach are disabled. The implementation plan is [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## P0.0 Governance acceptance and instruction reconciliation

- [x] Founder accepted the product boundary, `EN_DISCOVERY_ONLY` self-prospecting pilot, ROADMAP-V2 and ADR-001–008 without amendments (2026-10-04).
- [x] Reconciled `AGENTS.md`, `CLAUDE.md` and root source-of-truth references with accepted docs (2026-10-04).
- [x] Preserve `PACKAGE_VERIFIED` as the atomic, owner-validated, idempotent credit trigger, separate from human review and commercial payment (2026-10-04; ADR-007 accepted without amendment).
- [x] Marked old executable plans superseded without deleting decision history (2026-10-04).
- [x] Confirmed `docs/IMPLEMENTATION_PLAN.md` is not gitignored and checked local links in `docs/INDEX.md`, `README.md` and this backlog (2026-10-04).

## P0.1 Baseline and test separation

- [ ] Update Vitest config so unit/integration runs exclude `.claude/**`, `.worktrees/**`, `.next/**`, Playwright reports and `tests/e2e/**`.
- [ ] Add `test:unit`, `test:integration`, `typecheck:app`, `typecheck:worker` and retain separate `test:e2e` scripts.
- [ ] Fix the unsafe Supabase mock cast in `tests/auth.test.ts`.
- [ ] Record a baseline artifact: build, app/worker typecheck, unit, DB integration readiness and E2E prerequisites.
- [ ] Add a documentation drift check for framework version and canonical-doc links.

## P0.2 Security and correctness blockers

- [ ] Await campaign rate-limit evaluation and add an enforcement regression test.
- [ ] Replace the non-atomic chat daily counter with one atomic DB operation and a concurrency test.
- [ ] Fail worker startup/requests closed when `WORKER_SECRET` is missing or empty; replace raw shared-key requests with timestamped HMAC + nonce/idempotency and test missing/empty/wrong/expired/replayed signatures.
- [ ] Write a failing test proving a user cannot load another user's Glook scan through every warm path.
- [ ] Change Glook context loading to require authenticated owner/workspace context.
- [ ] Write a real Postgres integration test for lead/campaign/workspace ownership in the credit RPC.
- [ ] Add idempotency semantics for repeated signal processing and charging.
- [ ] Make run dispatch persist a job before campaign state changes; return the job id.
- [ ] Define partial/failed completion independently from “no candidates verified.”
- [ ] Reload the enriched lead/Opportunity projection before message generation.

## P0.3 Domain and application contracts

- [ ] Add Zod schemas and TypeScript types for EvidenceItem, Opportunity, OpportunityAssessment, BuyerCandidate, ContactVerification, ReviewDecision and Outcome.
- [ ] Add AuthContext, CostBudget and provider-independent error contracts.
- [ ] Define application capability interfaces without Next.js or Express response types.
- [ ] Record schema versions in persisted domain outputs.
- [ ] Cover SourceItem, Person, ContactPoint, MarketProfile, DiscoveryBrief, BuyerCandidate, ContactVerification, ReviewDecision, Outcome, SuppressionEntry and ArtifactMetadata contracts.
- [ ] Define versioned VerificationPolicy and deterministic `PACKAGE_VERIFIED` check results before changing the credit RPC.

## P0.4 Durable jobs and observability

- [ ] Add job, step attempt, provider run and cost event migrations with RLS.
- [ ] Implement atomic lease, heartbeat, retry wait and stale-lease recovery RPCs.
- [ ] Implement one atomic enqueue RPC that creates the job and changes campaign state together, with concurrency and rollback tests.
- [ ] Add idempotency key, correlation/trace ids and per-workspace budget.
- [ ] Expose integration health states: configured, missing credentials, disabled, rate-limited, degraded and error.
- [ ] Add worker recovery and duplicate-dispatch integration tests.

## P1.1 Provider wrapping

- [ ] Wrap Reddit/HN behind SignalSourceAdapter contract with sanitized recorded fixtures.
- [ ] Wrap Exa/Serper behind CompanyResolutionProvider.
- [ ] Split Prospeo/Hunter/Apollo into email finding and verification contracts.
- [ ] Add timeout, retry classification, rate-limit mapping, cost and provenance recording.
- [ ] Preserve current behavior behind a legacy workflow flag for comparison.

## P1.2 Opportunity Core

- [ ] Add migrations for offers/ICP, companies, evidence, opportunities, assessments, buyer candidates, contact verifications, reviews and outcomes.
- [ ] Implement deterministic Opportunity state machine.
- [ ] Implement evidence sufficiency policy by signal type.
- [ ] Implement multidimensional model assessment with QUALIFY/REVIEW/REJECT, separate from human ACCEPT/REJECT/NEEDS_RESEARCH.
- [ ] Create compatibility projection to current LeadCard while the new UI is built.

## P1.3 Self-prospecting workflow

For the accepted `EN_DISCOVERY_ONLY` pilot, execute discovery, evidence, Opportunity assessment and human review only. The contact/draft items below describe later jurisdiction-gated capability work and must not run in this pilot.

- [ ] Create the IntentLead offer/ICP fixture and market profile.
- [ ] Run discovery through the durable job service.
- [ ] Resolve company with evidence and confidence.
- [ ] Assess fit, impact, timing and actionability.
- [ ] Resolve buyer candidates based on problem/company context.
- [ ] Find and verify a contact only after Opportunity acceptance threshold.
- [ ] Generate a draft whose factual claims contain evidence references.
- [ ] Add human review and outcome recording UI.

## P1.4 End-to-end gate

- [ ] Run backend integration suite with fake adapters.
- [ ] Run RLS, idempotency, credit and job recovery tests against local Supabase/Postgres.
- [ ] Run Playwright cold/warm/review/error/mobile/accessibility flows.
- [ ] Run prompt-injection and evidence-poisoning fixtures.
- [ ] Execute a zero-spend fixture/mock smoke and save only redacted artifacts. A live provider smoke is deferred unless a free-only path proves zero external spend or the founder separately authorizes it.
- [ ] Have an independent reviewer verify code, migrations, security and UX before dogfood.

## P1.5 Glook contract migration

- [ ] Treat the owner-bound direct read as temporary debt with telemetry and an explicit removal gate.
- [ ] Define and contract-test the versioned `SiteContextSnapshot` in both repositories.
- [ ] Implement authenticated export/signed event and idempotent IntentLead import.
- [ ] Shadow-compare direct-read and contract output through a rollback window.
- [ ] Remove all direct Glook internal-table reads before any Glook-dependent production pilot, AI Visibility implementation or public MCP release.

## P2 Quality and pilot

- [ ] Label benchmark cases and founder review sample.
- [ ] Measure precision, false positives, company/buyer/contact accuracy, evidence coverage, freshness and cost.
- [ ] Add source-level funnel and rejection reason reporting.
- [ ] Define commercial pilot offer and charging semantics from measured value.
- [ ] Onboard 3–5 design partners only after the quality gate.

## Deferred until gated

- [ ] AI Visibility full module.
- [ ] Local/CIS source implementation beyond one experiment.
- [ ] Public MCP server.
- [ ] Assisted send and CRM integrations.
- [ ] Broad provider/source expansion.
