# Current state audit

**Verified:** 2026-10-06 on branch `codex/opportunity-core` after the local Task E schema cleanup.

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
| Database schema | Forward migration removes campaign/lead/contact/draft/message/chat/package/credit storage and compatibility RPCs | Keep production migration outside the authorized scope |

## Current execution gap

The worker injects `createSelfProspectingHandler` only in explicit `fixture` or `recorded` modes. `fixture` exercises the embedded synthetic deterministic contract. `recorded` requires a local, schema-valid, sanitized and explicitly authorized JSON evidence file supplied outside the repository. Both modes allow network access only to Supabase, record zero provider requests and cost, and cannot invoke live provider endpoints. `disabled` remains the default and unknown modes fail startup. OfferProfile, ICPDefinition and DiscoveryBrief are native authority. The Task E forward migration removes the historical campaign-linked graph, verified-contact/credit semantics and callable compatibility helpers; only migration history retains their definitions.

The critical sequence is therefore:

1. receive the founder-approved Offer/ICP/threshold inputs and one separately authorized recorded-evidence bundle;
2. run the controlled dogfood quality gate through the explicit local `recorded` mode;
3. measure Opportunity quality before enabling any live provider mode.

## Quality evidence for the reset

- GitNexus was re-indexed; individual removed exports had LOW impact. The aggregate public rewrite was rated HIGH because six connected landing/Auth/Lang flows changed together, so it received full build, browser and independent review gates.
- `npm run verify`: app and worker typecheck pass; lint has zero errors; 526 unit tests pass; production build passes.
- Browser smoke: 9/9 pass, including 404 assertions for retired public/API routes and sitemap exclusions.
- Independent review found no dangling imports, auth regression or product/security blocker.
- Task C unit/type gates pass with 529 unit tests. Its forward-only migration passed 4/4 real PostgreSQL tests covering concurrent idempotent creation, direct-RPC validation, tenant isolation, native enqueue/lifecycle and deletion without legacy campaign mutation.
- Task D full application verification passes: both typechecks, lint with zero errors (nine pre-existing `fluid-glass.tsx` warnings), 539 unit tests and the production build. The complete browser suite passes 16/16, including create → queue → Opportunity detail/evidence → human review.
- The repository-wide PostgreSQL command passes 88/88 across 11 integration files. `scripts/run-integration-tests.mjs` creates and removes a validated local `intentlead_test_*` database per file, so historical migration-stage fixtures cannot leak rows or schema into later suites.
- The synthetic Task D fixture persisted one reviewable Opportunity with two source/evidence records, three zero-request/zero-cost provider-shaped runs, stable same-job replay, distinct cross-job identities, outsider non-disclosure and one human review. No personal, contact, draft or message row was created. It is explicitly not the authorized recorded-evidence sample required by Task F.
- Task E focused integration evidence covers clean/populated upgrade, historical-state reconciliation, migration reapplication, RLS, deletion, durable leases/recovery, fixture persistence, review concurrency and worker nonce replay protection. After independent review, the final 17 blocker-regression assertions pass for upgrade states, accepted-review visibility and strict provider/source/evidence/grounded-claim persistence. The migration is forward-only; rollback is a database restore, not recreation of the retired graph.
- Task F pre-dogfood gate passes locally: 454/454 unit tests, 55/55 isolated PostgreSQL integration checks, 16/16 browser checks, both typechecks, the production build, and lint with zero errors plus nine pre-existing `fluid-glass.tsx` warnings. An initially stale application-context fixture was corrected and only its affected test was rerun.
- Independent domain, security and frontend review found three gate blockers: no recorded-evidence runtime, incomplete structured quality reasons, and acceptance without active evidence. The fixes add strict external-file authorization/schema checks with a Supabase-only network guard, provenance-preserving capture time and provider/source/PII validation, explicit poor-offer/ICP-fit, low-impact, bad-timing and unsupported-inference reasons, and matching UI/server acceptance guards. Focused evidence after those fixes: recorded runtime/workflow 36/36, review/domain 159/159, review PostgreSQL 13/13, missing-evidence browser regression 1/1 and both relevant typechecks; the already-green full suite was not repeated.
- The remaining Task F blocker is external evidence and approved product/preregistration input, not an unfinished code path. No recorded business evidence is committed to the repository.

No production deployment, production migration, real-source run, real sending or paid API call was performed.
