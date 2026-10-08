# IntentLead domain model

**Status:** Accepted target model, corrected 2026-10-06.

## Aggregate boundary

`Opportunity` is the central commercial aggregate. It is not complete for delivery until its evidence, company identity, offer/ICP relevance, likely buyer, available verified contact and grounded conversation angle have been assessed.

A raw observation is a `SourceItem`; a normalized fact or artifact is `EvidenceItem`; a typed commercial observation is a `Signal`. None is silently promoted to an Opportunity.

`Lead` may exist only as an export/view of a qualified Opportunity package. It is not a competing source of truth.

## Core entities

| Entity | Responsibility |
|---|---|
| Workspace | Tenant, budget and policy boundary |
| OfferProfile | What the user sells, outcome, commercial range and exclusions |
| ICPDefinition | Target company, buyer roles, market and negative criteria |
| MarketProfile | Language, geography, source/contact capabilities and policy |
| DiscoveryBrief | Bounded objective and requested result count for a run |
| SourcePlan | Selected provider capabilities, query families and budgets |
| SourceItem | Normalized immutable provider observation |
| EvidenceItem | Auditable fact or artifact with provenance and verification method |
| Company | Resolved business identity independent of provider payloads |
| Signal | Typed expressed intent, event, detected problem or market observation |
| Opportunity | Evidence-backed reason the company may fit the user's offer now |
| OpportunityAssessment | Fit, impact, timing, actionability, confidence and rejection reasons |
| BuyerCandidate | Evidence-backed hypothesis about the responsible role/person |
| ContactPoint | Public business contact and its exact source |
| ContactVerification | Validity, recency, ownership/role and provider evidence |
| ConversationBrief | Evidence-grounded angle, claims and low-friction CTA |
| Draft | Copyable draft whose material claims reference evidence ids |
| ReviewDecision | Human accept, reject or needs-research decision with reason |
| Outcome | Optional human-reported manual action and result |
| Job / StepAttempt | Durable workflow execution and retry state |
| ProviderRun / CostEvent | Provider/model usage, latency, cost and outcome |
| SuppressionEntry | Contact/channel opt-out or policy denial |

## Signal taxonomy

```text
EXPRESSED_INTENT
  recommendation_request | comparison | switching | complaint | solution_search | rfp

BUSINESS_EVENT
  hiring | funding | launch | expansion | leadership_change | technology_change

DETECTED_PROBLEM
  operations | acquisition | conversion | reputation | customer_experience | market_presence

MARKET_OBSERVATION
  competitor_change | review_pattern | category_gap | local_presence | visibility_gap
```

Evidence sources such as websites, maps, directories, reviews, communities, job boards or AI answers live in provenance. They do not define the product or silently change the signal type.

## Assessment and delivery readiness

The model returns `QUALIFY`, `REVIEW` or `REJECT` across separate dimensions:

- evidence strength and freshness;
- company-resolution confidence;
- offer and ICP fit;
- commercial impact;
- timing and actionability;
- buyer relevance;
- contact availability and verification;
- uncertainty and rejection reasons.

There is no authoritative combined intent score.

Opportunity assessment and package readiness are separate. A commercially relevant Opportunity may remain `NEEDS_RESEARCH` when buyer/contact evidence is insufficient.

## Lifecycle

```text
DISCOVERED
→ EVIDENCE_PENDING
→ ASSESSABLE | INSUFFICIENT_EVIDENCE
→ MODEL_QUALIFIED | MODEL_REVIEW | MODEL_REJECTED
→ BUYER_PENDING
→ CONTACT_PENDING | CONTACT_UNAVAILABLE
→ PACKAGE_READY | NEEDS_RESEARCH
→ HUMAN_REVIEW
→ ACCEPTED | REJECTED | NEEDS_RESEARCH
→ ARCHIVED
```

Models may propose assessments, buyer candidates and drafts. Deterministic application commands own persistence, state changes, authorization, provider budgets and review decisions.

## Invariants

- Every Opportunity references accessible evidence.
- Raw evidence and interpretation are stored separately.
- Every material claim declares an evidence reference or is explicitly labeled as inference.
- Company, buyer and contact each retain independent confidence and provenance.
- A ContactPoint without a public/authorized source cannot be delivered.
- A Draft cannot contain an unsupported material claim.
- Contact discovery happens only after evidence, company and ICP qualification.
- A missing contact remains missing; it is never synthesized.
- Workspace authority comes from authenticated membership, never a client-supplied workspace id.
- Provider payloads are provenance, not canonical domain schemas.
- Reprocessing is idempotent and cannot duplicate an Opportunity, contact or cost event.
- `EN_DISCOVERY_ONLY` permits research, verified contact and grounded draft creation, but never sending or mailbox action.
- Suppression and market policy can deny contact use even when public data exists.
- Outcome events describe human actions; they do not execute them.
