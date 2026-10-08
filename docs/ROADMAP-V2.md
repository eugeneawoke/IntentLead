# IntentLead product roadmap V2

**Status:** Corrected accepted direction, 2026-10-06.

IntentLead reduces “кому мне продавать?” to “вот компания, доказуемая причина, нужный человек, проверенный контакт и grounded opening angle”. It never sends messages.

## Product sequence

```text
Offer + ICP + market
→ source plan
→ at least 20 confirmed signals per complete run
→ evidence and company resolution
→ commercial assessment and deduplication
→ buyer and verified contact
→ grounded brief/draft
→ human review/export
→ optional human-reported outcome
```

## Stage 0 — Truth and visual recovery

**Outcome:** one canonical model and the established Signal Dark experience restored around it.

- remove the accidental “no contacts” and HN-only product boundary;
- retain the new Opportunity/durable-job backend;
- selectively restore the previous landing composition, motion, navigation and premium component language;
- rewrite old verified-lead/sending claims rather than deleting the visual system;
- establish capability and regression evals before further implementation.

**Gate:** docs, UI and tests describe the same product; no automatic-send affordance exists.

## Stage 1 — Complete self-prospecting vertical slice

**Outcome:** one reproducible `EN_DISCOVERY_ONLY` run produces complete Opportunity packages for IntentLead.

Required path:

```text
ICP → source discovery → signal/problem → company → evidence
→ assessment → buyer → verified contact → grounded draft → human review
```

Use existing Reddit, Hacker News, Exa, Serper and historical Prospeo/Hunter/Apollo work where it remains safe. Implement missing capabilities behind the provider registry. Missing keys produce `missing_credentials` and fallbacks, not fake success.

**Gate:** at least 20 confirmed evidence-backed signals in the complete run; unique-company and Opportunity counts reported separately; zero duplicates, zero unsupported material claims, contact provenance visible, no send action and no unapproved spend.

## Stage 2 — Multi-source global quality

**Outcome:** source selection is driven by the user's business and market rather than a fixed HN/Reddit pair.

Prioritized capability families:

1. public web/search and official company sources;
2. Reddit, Hacker News, GitHub and Stack Overflow;
3. jobs/company events via public career pages and legal feeds;
4. Product Hunt, review/comparison and competitor sources where access permits;
5. contact discovery/verification fallbacks.

**Gate:** measured provider funnel, company/buyer/contact accuracy, acceptance, latency and cost per accepted package.

## Stage 3 — CIS and local-business slice

**Outcome:** the same core works for one regional/local profile without forked domain logic.

Candidate sources include Yandex Search/Maps/Business/Webmaster, 2GIS, public Telegram/VK, vc.ru, Habr, local directories, review platforms and regional job/news sources. Each capability declares actual access status; manual-only and unavailable sources remain explicit.

A website, listing or review is analyzed only for a concrete offer-relevant finding, not as a mandatory technical audit.

**Gate:** one legal/free provider path, at least 20 confirmed signals/observations for the selected brief, evidence a user can verify quickly, and useful contacts/drafts without sending.

## Stage 4 — Design-partner workflow

**Outcome:** 3–5 users repeatedly receive packages they consider worth contacting.

Add polished onboarding, recurring briefs, export/CSV/Google Sheets where useful, review feedback and outcome recording. Pricing remains undecided until repeat use and delivery economics are measured.

**Gate:** repeated use, willingness to pay, accepted-package yield, contact validity and delivery economics by cohort.

## Stage 5 — Intelligence-domain expansion

Add one domain only when it improves accepted-package yield. Candidates include reviews/reputation, hiring, competitor change, local presence and AI Visibility observations. AI Visibility is an optional signal provider, not a required first-stage product.

## Stage 6 — Stable API/MCP capabilities

Expose typed, scoped capabilities only after the application contracts and asynchronous jobs stabilize. External automation cannot bypass the no-send boundary.

## Permanent boundaries

- no automatic or assisted sending from IntentLead;
- no mailbox connection, sequences, follow-ups or delivery tracking;
- no illegal scraping or ToS bypass;
- no invented company, buyer, contact or commercial fact;
- no universal website/SEO/AI-readiness audit;
- no price promise before value and economics evidence.
