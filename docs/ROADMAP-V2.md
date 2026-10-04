# IntentLead roadmap V2

**Status: Accepted 2026-10-04.** This roadmap replaces the old seven-phase build plan. It is ordered by validated user value, not feature count. The first self-prospecting pilot uses `EN_DISCOVERY_ONLY`; contact enrichment and outreach stay disabled in that pilot.

## Phase 0 — Architecture and truth reconciliation

**Objective:** establish one accurate product and technical model.

**User value:** prevents unreliable data, lost jobs and incorrect charging before pilot use.

**Why now:** code exists, but canonical documents describe a pre-code state and the current worker is not durable or idempotent.

**Prerequisites:** repository and supplied research audit complete.

**Architecture changes:** Opportunity/Evidence contracts, application capability boundary, MarketProfile, provider registry, durable job contract, structured errors, idempotency, cost and provenance conventions.

**Backend:** reconcile active agent instructions; fix warm-path ownership, async rate-limit enforcement, atomic chat quota, fail-closed worker secret, test scopes, dispatch acceptance, shared-database namespace and credit ownership/idempotency design.

**Frontend:** no redesign; define Opportunity loading/error/review states.

**Tests/evaluation:** repeatable baseline; real DB RLS/concurrency plan; threat cases; frozen initial fixtures.

**Observability/cost:** trace ids, job/provider status and budget contracts.

**Definition of Done:** documents agree with code; critical security/correctness fixes are planned with failing tests; legacy roadmap is explicitly historical; one approved immediate implementation plan exists.

**Kill/postpone:** no new providers or AI Visibility build until this gate passes.

## Phase 1 — Self-prospecting vertical slice

**Objective:** IntentLead finds usable Opportunities for IntentLead.

**User value:** proves the full path from discovery to a defensible conversation starter.

**Why now:** discovery-only dogfooding supplies immediate review labels; commercial outcomes require a later authorized outreach stage.

**Prerequisites:** Phase 0, one market profile, one offer/ICP, minimal legal source set.

**Architecture changes:** source adapters, evidence persistence, company resolution, Opportunity assessment, buyer/contact, grounded draft, review/outcome entities and compatibility Lead projection.

**Providers:** start with existing Reddit/HN plus existing Exa/Serper and contact providers only where credentials and terms permit.

**Agents:** bounded signal/opportunity analysis, ambiguous entity resolution, buyer hypothesis and outreach drafting; deterministic orchestration.

**MCP:** capability schemas become transport-neutral; no public server.

**Tests:** provider fixtures, pipeline integration, tenant denial, prompt injection, idempotent rerun, front-end review path and one controlled live smoke.

**Evaluation:** founder labels at least the declared pilot sample; record accepted, rejection reason, contact validity, cost and latency.

**Definition of Done:** the first pilot proves reproducible ICP→Opportunity→evidence→human decision on real companies under `EN_DISCOVERY_ONLY`, without contact enrichment, outreach, unsupported claims or duplicate charge. Buyer→verified contact→draft is a later jurisdiction-gated extension of the vertical slice, not a prerequisite for this discovery-only pilot.

**Kill/postpone:** do not scale a source that misses the agreed acceptance/economics threshold.

## Phase 2 — Opportunity quality and calibration

**Objective:** reduce false positives and quantify confidence.

**Changes:** golden dataset, taxonomy-specific policies, freshness decay, entity resolution evidence, buyer ranking, feedback loop, cost optimization and source funnel analytics.

**Tests:** repeated-run stability, wrong-company/person, stale/already-solved, weak evidence and adversarial content.

**Definition of Done:** precision, reviewer agreement, entity/buyer accuracy and cost targets are measured and pass the pilot gate.

## Phase 3 — Commercial pilot

**Objective:** sell a concierge/pilot outcome to 3–5 design partners.

**Changes:** workspace-safe review delivery, usage/charging policy, support runbook, manual outcome tracking and pilot reporting.

**Definition of Done:** repeat use, willingness to pay, positive conversations and gross-margin envelope are measured by cohort.

**Kill/postpone:** no subscription scale if users do not act on or reorder accepted Opportunities.

## Phase 4 — Intelligence expansion

**Objective:** add one intelligence domain only when it improves accepted-opportunity yield.

Candidate experiments: company/web events, hiring, reviews/reputation, competitor/switching. Each experiment uses provider registry, evidence and the same Opportunity core.

**Definition of Done:** incremental source/domain lift is demonstrated against the existing baseline.

## Phase 5 — AI Visibility opportunity module

**Objective:** turn repeated visibility observations into commercially relevant findings and Opportunities.

**Sequence:** prompt discovery → versioned portfolios → multi-engine observations → mentions/citations/competitors → findings → actions/experiments → Opportunity bridge.

**Definition of Done:** stable evidence across repeated observations and accepted commercial Opportunities; not merely a dashboard.

## Phase 6 — Local/CIS vertical slice

**Objective:** evidence-backed local Opportunities for one geography and high-value category.

**Sequence:** business discovery → official site/listing/review evidence → concrete problem → buyer/contact → draft → review/outcome.

**Definition of Done:** one legal provider path, one MarketProfile, measured acceptance and cost, and reproducible evidence users can verify quickly.

Phases 5 and 6 are candidate expansion work packages, not a committed ordering. After Phase 4, choose at most one first from preregistered demand, access/compliance feasibility, evidence quality and economics; postpone the other.

## Phase 7 — International and compliance expansion

Add markets, languages and providers only through MarketProfile. Each market requires data-access classification, retention/opt-out rules, provider availability and quality/economics proof.

## Phase 8 — MCP capability release

MCP-readiness begins in Phase 0; public/private MCP ships only after application capabilities stabilize. Release typed tools/resources, scoped auth, async jobs, pagination, idempotency, budgets, audit logs and examples.

## Phase 9 — Workflow ecosystem

CRM sync, assisted send, external automations and MCP client adapters follow proven core value and compliance. Human approval remains default; autonomous mass sending remains out of scope.

## Old roadmap disposition

**Keep:** RLS, server-only service role, async worker, manual-send default, verified-only charging intent, prompt-injection defense, warm bridge concept and grounded outreach.

**Rewrite:** fixed four-level verification, linear signal→lead model, single intent threshold, static source lists, fixed vendor waterfall and phase numbering.

**Move later:** assisted send, dashboard analytics, broad multi-workspace, CRM, public MCP and broad source expansion.

**Freeze pending proof:** direct shared-DB Glook integration, PayPro reuse, regional source/API legality.

**Deprecate:** “code not started,” Next.js 16 as current fact, the one-shot autonomous build prompt and unmeasured reply/verified/cost claims as release gates.
