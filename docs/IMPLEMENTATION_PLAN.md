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

## Task J — Generalize provider/model foundations

- [x] Represent the broad provider catalog through typed capabilities and explicit activation states without implying live integration (2026-10-08).
- [x] Separate `PERSON_SEARCH`, `EMAIL_FIND` and `EMAIL_VERIFY`; do not conflate “found” with “verified” (2026-10-08).
- [x] Implement activation/health states including `configured`, `missing_credentials`, `paid_locked`, `disabled`, `rate_limited`, `degraded` and `error`; missing state fails closed (2026-10-08).
- [x] Enforce cheap-to-expensive selection, per-provider reservation, timeout, fallback, cost and jurisdiction policies (2026-10-08).
- [x] Add a model-provider boundary for structured intake, analysis and drafting with independent budgets and no evidence/tool authority (2026-10-08).
- [x] Keep Exa/Serper/Prospeo/Hunter/Apollo as disabled or paid-locked descriptors and fixture contracts only; make no live paid calls (2026-10-08).

**Done when:** the whole provider/model landscape can be represented honestly, missing state fails closed and no adapter can bypass policy, budget or activation gates.

**Result (2026-10-08):** complete at the registry/contract boundary. Provider execution now requires a trusted catalog descriptor in live mode, one-time top-level and nested reservations, registry timeout, bijective related-run provenance and validated configured/reserved/actual cost. Generic fixture execution is test-only and zero-cost; production fixture/recorded workflows remain separate no-network implementations. The model registry builds fixed system plus untrusted-user messages, verifies existing evidence, requires grounded claims to cite only authorized evidence, reserves cost/token/call ceilings before invocation and charges the reservation on timeout or malformed/error outcomes. All paid descriptors remain unreachable. The second independent security review blockers were resolved; no live provider/model call was made.

## Task K — Free/legal multi-source planning and adapters

- [x] Add a `SourcePlan` contract and deterministic provider selection by signal family, market, business type, access status and expected value (2026-10-10).
- [x] Keep Reddit and HN; add prioritized free/legal adapters for GitHub and Stack Overflow/public web where practical (2026-10-10).
- [x] Add official-site/public-business-contact fallback with exact source URL (2026-10-10).
- [x] Add public RSS/blog/changelog and career-page foundations; prefer structured Greenhouse/Lever/Ashby endpoints where permitted (2026-10-10).
- [x] Represent Product Hunt, reviews, jobs, news, maps and regional sources in the matrix even when status is manual-only/unavailable (2026-10-10).
- [x] Add `GLOBAL_EN`, `CIS`, `RU`, `BY`, `KZ` and local-business profile foundations without scattered country conditionals (2026-10-10).
- [x] Preserve raw candidate counts, confirmed-signal counts, unique companies and accepted Opportunities as separate metrics (2026-10-10).

**Done when:** no workflow is hard-coded to one source pair, a useful zero-paid-provider portfolio exists and capability gaps are explicit.

**Result (2026-10-10):** code-complete and live-disabled. `SourcePlan` selects by profile, business type, signal family, operational/legal state, explicit expected value and budget, validates status and executable snapshots, and rejects plans outside the authorized workspace/brief. Budget-compatible sources are ranked before portfolio truncation, so an incompatible source cannot displace an executable one. The durable fixture worker executes a real no-network GitHub + Stack Exchange portfolio through the provider registry only with active guard-issued authority outside tests, preserves each source run and exact provenance, then continues through assessment and persistence; it does not synthesize a portfolio run. Authority is revoked when the guard is restored. Adapters enforce host/path/source identity, response/request bounds, full provider backoff and exhausted-quota stops. The official-site fallback has no raw HTTP path: future activation requires an authority-aware public-egress implementation, and it only returns company role addresses with exact page provenance. RSS/blog/changelog, career pages, Greenhouse/Lever/Ashby and the broader global/regional matrix remain explicit planned foundations. Funnel results distinguish raw, normalized, deduplicated, processed, confirmed, unique-company and returned-Opportunity counts; accepted count is `null` until human-review aggregation is measured. The focused 107-test eval passes three deterministic repeats. New additive migrations extend replay metrics and the source-provider allowlist but were not applied to production. All live source descriptors remain `disabled`; no network, paid call, production migration or sending occurred.

## Task K2 — Conversational LLM layer

- [ ] Convert natural-language user input into a reviewable Offer, ICP, market, exclusions and discovery target.
- [ ] Ask bounded clarification questions when required constraints are missing; never silently invent them.
- [ ] Route interpretation, buyer hypotheses and drafting through typed model capabilities with versioned prompts and output schemas.
- [ ] Treat source content as untrusted data and prevent it from selecting tools, providers, recipients or policies.
- [ ] Support one founder-selected model first while keeping OpenAI, Anthropic, Gemini and local models replaceable adapters.
- [ ] Record model/version, tokens, latency, cost, evidence references and limitations; default live-call budget remains zero until configured.

**Done when:** a user can describe the search in normal language, approve the structured brief and receive explanations grounded only in collected evidence.

**Partial result (2026-10-10):** the review-only foundation is complete locally: bounded user turns, strict structured output, deterministic missing/ambiguity clarification state, exact user-turn support, immutable versioned prompts, fixture-only execution and model telemetry. A second contract slice adds lossless human approval into a V2 DiscoveryBrief command: buyer intent remains in the ICP, raw market intent remains separate from normalized jurisdictions, requested confirmed signals remains separate from execution limits, and every added language carries explicit provenance. The generic authenticated create path remains V1-only; approved V2 persistence is isolated behind a server-only application capability and service-role-only forward migration, and never starts a job. The first focused 56-test eval and the approval-focused 34-test eval each pass three deterministic repeats (`pass^3 = 1.00`); both typechecks and targeted lint pass. The V2 PostgreSQL test is authored but not executed because no disposable database URL is configured. A third slice implements the founder-selected provider boundary for OpenAI through the Responses API: registry-owned instructions and untrusted user input stay separate, strict capability JSON Schema is mandatory, exact-model compatibility and returned-model provenance are checked, a conservative preflight bound prevents input-token budget overruns, tools/storage/background mode are absent, SDK retries are zero, and refusals/incomplete/malformed responses fail closed while retaining provider response provenance and known usage. The request fingerprint binds the prompt and payload for reservation integrity but is not claimed as HTTP idempotency; durable invocation deduplication remains required before live activation. The trusted OpenAI descriptor remains `paid_locked`, with no chosen model, credential, price or non-zero budget, so no live call can occur. The focused adapter/model gate passes 25 tests with both typechecks and targeted lint; independent post-fix review passed after its provenance/accounting blocker was corrected. A fourth slice exposes only the authenticated approval transport: a short-lived HMAC receipt binds the exact server-produced review to the authenticated user before service-role V2 persistence, a strict fail-closed limiter protects the privileged write, and approval creates a DRAFT without starting a job. Its focused 17-test gate, both typechecks and targeted lint pass; independent security review found no P0–P2 issue and its fail-open limiter finding was corrected without changing the shared limiter. Review generation and UI are still absent, and no live model call, paid call, production migration/deploy or external action was added. Lexical support does not prove semantic interpretation or polarity, so human approval remains mandatory. Task K2 stays in progress and its checklist remains open.

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

## Task P — Demand-gated paid providers

- [ ] Start only after design-partner interest or measured free-source coverage gaps.
- [ ] Revalidate current terms, quotas, pricing, credentials and market availability for each candidate.
- [ ] Enable Exa, Serper, Prospeo, Hunter or Apollo one at a time behind existing registry, reservation and cost controls.
- [ ] Measure incremental accepted-package yield, contact coverage and cost before enabling the next provider.

**Gate:** explicit founder approval and spend ceiling per provider. This task is not authorized in the current pilot.

## Milestone quality gates

At each task: focused tests for changed behavior, relevant typecheck/lint, GitNexus detect-changes and independent review.

At the end of Tasks H, I/J, L and M: one proportional full gate covering app/worker typechecks, lint, unit tests, relevant disposable-PostgreSQL suite, production build and focused browser journeys. Do not rerun an unchanged green full gate after a narrow documentation or fixture correction.
