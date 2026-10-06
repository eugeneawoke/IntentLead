# Current state audit

**Verified:** 2026-10-06 on branch `codex/opportunity-core` after `523939b` and `92571ce`.

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
| Web application | Opportunity landing, method, roadmap, privacy/terms and authenticated review workspace | Add native brief workflow after Task C |
| Auth and tenancy | Supabase auth helpers, application authorization and RLS foundations | Preserve negative tenant tests |
| Opportunity contracts | Versioned Evidence, Company, Opportunity, review and governance contracts | Keep provider-independent |
| Durable jobs | Lease, recovery, cancellation and replay protections implemented locally | Rewire around native DiscoveryBrief |
| Provider registry | Capability, provenance, reservation and cost policies implemented | Add explicit no-network fixture set |
| Self-prospecting | Discovery-only handler and persistence adapter implemented | Wire into the worker in Task D |
| Human review | List, detail and decision APIs/UI implemented | Use for dogfood quality feedback |
| Glook | Versioned snapshot consumer exists with contract tests; no active route or direct table read | Keep dormant and optional |
| Legacy lead runtime | Pipeline, provider wrappers, API/export, cards and message code removed | Keep absent |
| Legacy public runtime | Pricing, compare, chat, RAG and anonymous campaign-transfer surfaces removed | Keep absent |
| Database bridge | Applied historical campaign/lead/contact/draft/chat-credit objects remain in migrations and compatibility tests | Remove through forward migration in Task E |

## Current execution gap

The worker does not yet inject `createSelfProspectingHandler`. A discovery job therefore cannot complete the accepted pilot end to end and terminates through the unavailable-capability path. OfferProfile, ICPDefinition and DiscoveryBrief also still depend on legacy campaign authority.

The critical sequence is therefore:

1. make OfferProfile, ICPDefinition and DiscoveryBrief the native authority;
2. wire the self-prospecting handler with recorded evidence, no network and zero cost;
3. remove the legacy schema bridge through additive migrations;
4. run the controlled dogfood quality gate.

## Quality evidence for the reset

- GitNexus was re-indexed; individual removed exports had LOW impact. The aggregate public rewrite was rated HIGH because six connected landing/Auth/Lang flows changed together, so it received full build, browser and independent review gates.
- `npm run verify`: app and worker typecheck pass; lint has zero errors; 526 unit tests pass; production build passes.
- Browser smoke: 9/9 pass, including 404 assertions for retired public/API routes and sitemap exclusions.
- Independent review found no dangling imports, auth regression or product/security blocker.

No production deployment, production migration, real-source run, real sending or paid API call was performed.
