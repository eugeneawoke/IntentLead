# Current state audit

**Verified:** 2026-10-06 on branch `codex/opportunity-core` after the Task C native-authority implementation.

This document reports current local code, not planned scope and not production state.

## Product boundary now represented in code

IntentLead is an Opportunity Intelligence Engine. The active application presents business context → public evidence → company resolution → commercial assessment → human review. A website may supply product, audience and positioning context; the application does not run a technical, SEO or AI-readiness audit.

No active UI, API or worker route provides:

- lead/contact or email enrichment;
- message generation or outreach planning;
- sending, mailbox connection, sequences or delivery tracking;
- verified-lead pricing, credit guarantees or competitor claims;
- direct reads from Glook internal tables.

## Verified implementation inventory

| Area | Current local state | Next disposition |
|---|---|---|
| Web application | Opportunity landing, authenticated discovery brief UI, review workspace and native DiscoveryBrief APIs | Run the controlled dogfood after legacy schema removal |
| Auth and tenancy | Supabase auth helpers, application authorization and RLS foundations | Preserve negative tenant tests |
| Opportunity contracts | Versioned Evidence, Company, Opportunity, review and governance contracts | Keep provider-independent |
| Durable jobs | Lease, recovery, cancellation and replay protections use native DiscoveryBrief authority | Preserve through schema cleanup |
| Provider registry | Capability, provenance, reservation and cost policies implemented; fixture mode is no-network | Keep live adapters disabled |
| Self-prospecting | Explicit fixture-mode worker wiring, DB persistence and network guard implemented locally | Keep live providers disabled through the pilot |
| Human review | List, detail and decision APIs/UI implemented | Use for dogfood quality feedback |
| Glook | Versioned snapshot consumer exists with contract tests; no active route or direct table read | Keep dormant and optional |
| Legacy lead runtime | Pipeline, provider wrappers, API/export, cards and message code removed | Keep absent |
| Legacy public runtime | Pricing, compare, chat, RAG and anonymous campaign-transfer surfaces removed | Keep absent |
| Database bridge | Applied historical campaign/lead/contact/draft/chat-credit objects remain in migrations and compatibility tests | Remove through forward migration in Task E |

## Current execution gap

The worker now injects `createSelfProspectingHandler` only when `SELF_PROSPECTING_MODE=fixture`. That mode exercises a synthetic deterministic contract with zero provider requests and cost; it is not the recorded authorized dogfood sample. `disabled` remains the default and unknown modes fail startup. OfferProfile, ICPDefinition and DiscoveryBrief are native authority. Historical campaign-linked database objects are not reachable through the active API but remain local schema debt.

The critical sequence is therefore:

1. remove the legacy schema bridge through additive migrations;
2. run the controlled dogfood quality gate.

## Quality evidence for the reset

- GitNexus was re-indexed; individual removed exports had LOW impact. The aggregate public rewrite was rated HIGH because six connected landing/Auth/Lang flows changed together, so it received full build, browser and independent review gates.
- `npm run verify`: app and worker typecheck pass; lint has zero errors; 526 unit tests pass; production build passes.
- Browser smoke: 9/9 pass, including 404 assertions for retired public/API routes and sitemap exclusions.
- Independent review found no dangling imports, auth regression or product/security blocker.
- Task C unit/type gates pass with 529 unit tests. Its forward-only migration passed 4/4 real PostgreSQL tests covering concurrent idempotent creation, direct-RPC validation, tenant isolation, native enqueue/lifecycle and deletion without legacy campaign mutation.
- Task D full application verification passes: both typechecks, lint with zero errors (nine pre-existing `fluid-glass.tsx` warnings), 539 unit tests and the production build. The complete browser suite passes 16/16, including create → queue → Opportunity detail/evidence → human review.
- The repository-wide PostgreSQL command passes 88/88 across 11 integration files. `scripts/run-integration-tests.mjs` creates and removes a validated local `intentlead_test_*` database per file, so historical migration-stage fixtures cannot leak rows or schema into later suites.
- The synthetic Task D fixture persisted one reviewable Opportunity with two source/evidence records, three zero-request/zero-cost provider-shaped runs, stable same-job replay, distinct cross-job identities, outsider non-disclosure and one human review. No personal, contact, draft or message row was created. It is explicitly not the authorized recorded-evidence sample required by Task F.

No production deployment, production migration, real-source run, real sending or paid API call was performed.
