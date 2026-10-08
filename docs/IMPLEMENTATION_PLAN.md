# Opportunity package implementation plan

**Status:** Active, corrected 2026-10-06.

## Goal

Deliver the actual first vertical slice: a preserved Signal Dark product experience and a reproducible self-prospecting workflow that finds at least 20 confirmed signals, resolves companies, identifies relevant buyers, verifies available contacts, prepares evidence-grounded drafts and stops before sending.

## Current authorization

- local development, migrations and tests are allowed;
- production deploy and production migration are not allowed;
- paid API calls/provider spend are not allowed;
- real or automatic sending is not allowed;
- free/legal provider adapters, fixtures, recorded evidence and missing-credential behavior may be implemented;
- GitNexus impact/detect-changes, focused tests and independent review remain required;
- repository-wide gates run at milestone boundaries, not after every small edit.

## Corrected baseline

Tasks 0–8 and Tasks A–F produced valuable Opportunity contracts, tenant isolation, durable jobs, provider registry, evidence provenance, company resolution, review UI and test infrastructure.

The 2026-10-06 reset also introduced two regressions that must be corrected:

1. the established public visual layer was deleted instead of having its copy/data flow adapted;
2. buyer/contact/draft capabilities and the multi-source product were incorrectly declared out of scope.

Historical commits remain implementation evidence, not current product authority.

## Task G — Correct governance and define evals

- [x] Restore the agreed product path in PRODUCT, DOMAIN_MODEL, ARCHITECTURE and ROADMAP (2026-10-06).
- [x] Reconcile INDEX, CAPABILITY_MAP, PROVIDER_MATRIX, MARKET_PROFILES, TEST_STRATEGY, AI_EVALUATION_STRATEGY, backlog, current-state audit and user actions (2026-10-06; link and contradiction audit passed).
- [x] Revise ADR-001 and add a durable buyer/contact/draft/no-send decision (2026-10-06; ADR-009).
- [x] Reconcile AGENTS.md and CLAUDE.md locally; keep protected files out of commits (2026-10-06).
- [x] Add a versioned capability/regression eval definition before code changes (2026-10-06; `tests/evals/opportunity-package-v1.md`).

**Done when:** no active document describes contacts/drafts as outside the product, no document implies HN-only discovery, and no document authorizes sending.

**Result (2026-10-06):** complete. Independent read-only review found no remaining contact, source, volume, pricing, freshness, website-analysis or sending contradiction; all local Markdown links resolve. Executable eval implementation remains a separate backlog item.

## Task H — Restore the established visual system

- [x] Compare current UI with the last complete Signal Dark baseline and preserve the new Opportunity routes/backend (2026-10-08).
- [x] Restore/adapt the previous hero, data-grid atmosphere, dock navigation, composer/intake interaction, workflow cards and footer treatment (2026-10-08).
- [x] Restore only truthful package/source shells; do not revive unverified competitor, reply-rate, credit or delivery claims (2026-10-08).
- [x] Apply the same visual language to the current discovery, Opportunity list/detail and target package shell; dedicated runtime buyer/contact/draft surfaces remain Task L (2026-10-08).
- [x] Verify responsive layout, keyboard/focus, reduced motion and route integrity with focused browser checks and screenshots (2026-10-08).

**Done when:** the product again looks like the established IntentLead experience, not the accidental stripped-down replacement, while presenting the corrected workflow.

**Result (2026-10-08):** complete for the implemented surfaces. Signal Dark is restored without changing the approved interaction model. Independent frontend review findings on truthful future-state copy, market fallback, focus, contrast, reduced motion and CSS scoping were resolved. Focused browser journeys pass 2/2 and the production build passes.

## Task I — Reintroduce buyer, contact and draft contracts

- [x] Restore or implement versioned `Person`, `BuyerCandidate`, `ContactPoint`, `ContactVerification`, `ConversationBrief`, `Draft` and `SuppressionEntry` schemas (2026-10-08).
- [x] Add claim-to-evidence references and explicit contact verification/source states (2026-10-08).
- [x] Extend MarketProfile capability policy so `EN_DISCOVERY_ONLY` permits research/contact/draft but denies every send/mailbox action (2026-10-08).
- [x] Add forward-only `intentlead_` migrations, RLS, indexes, deletion and idempotency rules (2026-10-08; local/disposable only).
- [x] Add negative cross-tenant, unsupported-claim, invalid-contact, stale-binding and suppression tests (2026-10-08).

**Done when:** a qualified Opportunity can become a tenant-safe, evidence-grounded package without any sending capability.

**Result (2026-10-08):** complete at the contract/storage boundary. Independent security review findings were resolved: canonical suppression hashes, current finite verification, buyer/contact binding, invalidation of stale packages, old/new claim coverage, Unicode offsets, research-only jobs/errors and contact policy/confidence are enforced. App/worker typechecks, 505/505 unit tests and the focused disposable-PostgreSQL suite (5/5) pass.

## Task J — Restore and harden provider capabilities

- [ ] Reuse the safe parts of historical Exa/Serper and Prospeo/Hunter/Apollo integrations behind current typed registries.
- [ ] Separate `PERSON_SEARCH`, `EMAIL_FIND` and `EMAIL_VERIFY`; do not conflate “found” with “verified”.
- [ ] Add official-site/public-business-contact fallback with exact source URL.
- [ ] Implement health states: `configured`, `missing_credentials`, `disabled`, `rate_limited`, `error`.
- [ ] Enforce cheap-to-expensive selection, per-provider reservation, timeout, fallback, cost and jurisdiction policies.
- [ ] Do not make live paid calls; use fixtures/contracts and free-only adapters where separately safe.

**Done when:** missing keys degrade honestly, contact provenance is retained and provider code cannot bypass budget or policy.

## Task K — Multi-source planning and adapters

- [ ] Add a `SourcePlan` contract and deterministic provider selection by signal family, market, business type, access status and expected value.
- [ ] Keep Reddit and HN; add prioritized free/legal adapters for GitHub and Stack Overflow/public web where practical.
- [ ] Represent Product Hunt, reviews, jobs, news, maps and regional sources in the matrix even when status is manual-only/unavailable.
- [ ] Add `GLOBAL_EN`, `CIS`, `RU`, `BY`, `KZ` and local-business profile foundations without scattered country conditionals.
- [ ] Preserve raw candidate counts, confirmed-signal counts, unique companies and accepted Opportunities as separate metrics.

**Done when:** no workflow is hard-coded to one source pair and capability gaps are explicit.

## Task L — Complete self-prospecting workflow

- [ ] Extend the durable workflow through buyer resolution, contact verification and grounded draft persistence.
- [ ] Make the requested target count at least 20 for a complete product run.
- [ ] Add Opportunity-package UI and copy/export actions; no send action.
- [ ] Record review reasons including wrong company, wrong person, contact invalid, weak signal, duplicate and unsupported inference.
- [ ] Record optional human-reported outcome without mailbox integration.

**Done when:** the reproducible flow reaches ICP → evidence → company → Opportunity → buyer → verified contact → grounded draft → human review.

## Task M — Evaluation and controlled dogfood

- [ ] Build fixtures covering expressed intent, detected problem, wrong company/person, stale/solved evidence, duplicate, missing/invalid contact, injection and unsupported draft claim.
- [ ] Run a minimum-20 confirmed-signal evaluation with recorded or explicitly authorized free sources.
- [ ] Measure unique companies, accepted packages, company/buyer/contact accuracy, duplicate rate, evidence accessibility, claim grounding, latency and cost.
- [ ] Obtain independent domain, security and frontend review.
- [ ] Decide GO, REWORK or STOP for a larger run.

**Gate:** zero unsupported material claims, zero duplicate packages, zero unapproved spend, zero sending and complete provenance. Volume never overrides quality; a shortfall below 20 is reported as a shortfall, not padded.

## Task N — CIS/local vertical slice

- [ ] Select one market and high-value business category from the user brief rather than a permanent global ICP.
- [ ] Implement the best available legal/free regional discovery path plus public-site contact fallback.
- [ ] Produce concrete, quickly verifiable findings from business-wide evidence; do not force a website audit.
- [ ] Reuse the same package, review and evaluation model.

**Done when:** one regional run proves the architecture is not global-English-only.

## Milestone quality gates

At each task: focused tests for changed behavior, relevant typecheck/lint, GitNexus detect-changes and independent review.

At the end of Tasks H, I/J, L and M: one proportional full gate covering app/worker typechecks, lint, unit tests, relevant disposable-PostgreSQL suite, production build and focused browser journeys. Do not rerun an unchanged green full gate after a narrow documentation or fixture correction.
