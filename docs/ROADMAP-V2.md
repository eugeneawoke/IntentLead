# IntentLead product roadmap

**Status:** Accepted direction, revised 2026-10-06.

IntentLead is an Opportunity Intelligence Engine. It discovers businesses with a concrete, evidence-backed commercial reason to consider a user's offer. The product ends at an inspectable Opportunity package and human decision. It does not send messages, operate mailboxes or automate outreach.

## Product sequence

```text
Offer + ICP + market
→ business discovery
→ observable signal, event or problem
→ evidence and provenance
→ company resolution
→ commercial assessment
→ Opportunity package
→ human review and feedback
```

A website, Glook snapshot, map listing, review, public post, job posting or AI-answer observation is only a possible evidence source. None is the product boundary or a mandatory stage.

## Stage 0 — Opportunity foundation

**Outcome:** one durable, tenant-safe and provider-independent Opportunity Core.

This stage establishes versioned domain contracts, evidence provenance, provider registry, market profiles, durable jobs, cost controls, application authorization and human review.

**Current state:** contracts, storage, durable jobs and review foundation are implemented locally. Worker cutover, native brief authority and legacy removal remain in progress. Production deployment and migrations remain outside the authorized scope.

## Stage 1 — Self-prospecting discovery

**Outcome:** IntentLead finds reviewable Opportunities for IntentLead itself under `EN_DISCOVERY_ONLY`.

The system receives IntentLead's offer, ICP, exclusions and market, then discovers companies, captures evidence, resolves company identity and produces `QUALIFY`, `REVIEW` or `REJECT` assessments. The founder reviews results and records rejection reasons.

The first run uses sanitized recorded evidence and zero paid-provider spend. It does not depend on Glook, website analysis, contact enrichment, message drafting or any sending capability.

**Gate:** a reproducible sample with measured acceptance rate, company-resolution quality, evidence sufficiency, false-positive reasons, latency and cost.

## Stage 2 — Opportunity quality

**Outcome:** high precision and explainable rejection on a larger self-prospecting sample.

Improve evidence policies, freshness, entity resolution, deduplication, commercial-fit assessment, reviewer feedback and source economics. Prefer rejecting uncertain candidates over filling a list.

**Gate:** predeclared precision, reviewer agreement and cost-per-accepted-Opportunity thresholds pass.

## Stage 3 — Design-partner workflow

**Outcome:** 3–5 users repeatedly receive Opportunities they consider worth acting on.

Add workspace-safe offer/ICP management, bounded discovery briefs, Opportunity delivery, review reasons and export of the evidence package. A user may optionally copy a conversation brief or draft, but IntentLead does not send it and does not track mailbox delivery.

**Gate:** repeat use, willingness to pay, accepted-Opportunity yield and delivery economics are measured by cohort.

## Stage 4 — Intelligence-domain expansion

**Outcome:** one additional detector materially improves accepted-Opportunity yield.

Candidate domains include expressed public intent, company and market changes, hiring, reviews/reputation, competitor changes, local-business evidence and operational/commercial gaps. Choose one from measured customer demand, legal access, evidence quality and economics. Do not add sources for coverage optics.

A company website may supply business identity and context: products, audience, positioning and public claims. Technical, SEO and AI-readiness auditing are outside the accepted product scope. Glook may later supply a versioned business-context snapshot, but it is not required by the core workflow.

## Stage 5 — Market expansion

**Outcome:** the validated workflow works in one additional market or language without forking domain logic.

Expand through `MarketProfile`, provider capability and evidence policy. Each market requires an explicit access/compliance assessment and measured source quality.

## Stage 6 — Capability API and MCP

**Outcome:** stable Opportunity capabilities can be consumed safely by external software and agents.

Expose typed, workspace-aware, budgeted capabilities and resources only after application services and async jobs are stable. MCP and REST are transports over the same domain services.

## Deferred research modules

AI Visibility, local visibility and other deep intelligence modules remain research candidates. They are not part of Stages 0–3. A module enters implementation only after the core is validated and a design-partner problem justifies it. AI Visibility, if selected, produces evidence and findings for Opportunity assessment; it is never treated as buying intent by itself.

## Permanent non-goals

- automatic or assisted sending;
- mailbox connection, sequencing, follow-ups or delivery tracking;
- AI SDR behavior;
- a CRM or proprietary contact database;
- bulk lead generation without inspectable evidence;
- a generic website, SEO or AI Visibility dashboard;
- provider-specific domain logic;
- direct reads of another product's internal tables;
- claims that a proxy proves lost revenue or purchase intent.

## Decision rule

Every roadmap item must answer:

> Does this help a user find a business with a concrete, defensible reason to consider the user's offer?

If not, it is outside IntentLead Core.
