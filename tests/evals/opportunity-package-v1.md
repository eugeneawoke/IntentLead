# EVAL DEFINITION: Opportunity package v1

**Baseline:** `36640b0` documents an incomplete discovery-only runtime and stripped public UI.

## Capability evals

### Source planning

- [ ] Global SaaS, CIS SaaS, local service and agency briefs select different relevant source families.
- [ ] A provider with prohibited access, missing capability or exhausted budget is not invoked.
- [ ] Free/legal/healthy sources precede paid enrichment.

### Volume and funnel truth

- [ ] A recorded corpus with enough valid evidence yields at least 20 confirmed signals.
- [ ] Raw candidates, confirmed signals, unique companies, Opportunities and contact-ready packages are counted separately.
- [ ] Duplicate, stale, wrong-company and weak candidates do not count toward the requested target.
- [ ] Exhausted sources return `PARTIAL` and an exact shortfall instead of fabricated filler.

### Company, buyer and contact

- [ ] Every selected company is linked to evidence; ambiguity remains unresolved when necessary.
- [ ] Buyer role/person relevance depends on the problem, offer, company and market.
- [ ] Every delivered contact has an authorized/public source, capture time, verification state and freshness.
- [ ] No guessed email, identity, role or company relation is accepted.

### Grounded brief/draft

- [ ] Every material factual claim maps to one or more EvidenceItem ids.
- [ ] Unsupported claims fail closed or are explicitly labeled as unverified inference.
- [ ] Adversarial source text cannot alter system instructions or trigger a tool/action.
- [ ] The UI supports copy/export only; no send control exists.

### Product experience

- [ ] Landing and workspace use the established Signal Dark visual language.
- [ ] Landing communicates the full signal → evidence → company → contact → brief workflow.
- [ ] Examples are visibly labeled and never presented as live data.
- [ ] Responsive layouts work at 375, 768, 1200 and 1440 CSS pixels.
- [ ] Keyboard focus and reduced-motion behavior remain usable.

## Regression evals

- [ ] Opportunity, Evidence and durable-job contracts remain valid.
- [ ] Foreign-tenant access is denied for source, Opportunity, contact and draft data.
- [ ] Repeated execution creates no duplicate source, company, Opportunity, contact, draft or cost event.
- [ ] Current auth, discovery, evidence and human-review routes remain functional.
- [ ] `/chat`, mailbox, send, sequence, follow-up and delivery capabilities remain absent.
- [ ] No old credit guarantee, bounce/reply claim, invented price or stale competitor claim is restored.

## Graders and thresholds

- Deterministic no-send, tenancy, idempotency and provenance: `pass^3 = 1.00`.
- Capability/product quality on versioned fixtures: `pass@3 >= 0.90`.
- Visual quality and commercial usefulness require independent/human review.
- Synthetic fixtures cannot be used as proof of live provider or market quality.

## Milestone evidence

- focused unit/contract tests while implementing;
- one additive PostgreSQL clean/upgrade/RLS/deletion suite for contact/draft storage;
- one workflow fixture with more than 20 mixed-quality candidates;
- one browser journey from intake through contact/draft review;
- one final app/worker typecheck, lint, unit, relevant integration, build and browser gate;
- GitNexus `detect_changes` and independent domain/security/frontend review before commit.
