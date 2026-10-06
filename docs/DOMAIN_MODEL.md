# IntentLead domain model

**Status:** Accepted target model, revised 2026-10-06.

## Aggregate boundary

`Opportunity` is the central commercial aggregate. A raw observation is not a Lead and does not become an Opportunity until evidence, company identity and offer/ICP relevance have been assessed.

`Lead` is not a target-domain entity. Existing `leads` and `messages` tables are legacy storage to be retired after the Opportunity read path and deletion/migration checks are complete.

## Core entities

| Entity | Responsibility |
|---|---|
| Workspace | Tenant, budget and policy boundary |
| OfferProfile | What the user sells, outcome, exclusions and commercial range |
| ICPDefinition | Target company characteristics, market and negative criteria |
| MarketProfile | Language, region, available capabilities and data policy |
| DiscoveryBrief | Bounded objective for finding Opportunities |
| SourceItem | Normalized immutable provider observation |
| EvidenceItem | Auditable fact or artifact with provenance and verification method |
| Company | Resolved business identity independent of provider payloads |
| Signal | Typed expressed intent, event, detected problem or market observation |
| Opportunity | Evidence-backed reason the company may fit the user's offer now |
| OpportunityAssessment | Fit, impact, timing, actionability, confidence and rejection reasons |
| ReviewDecision | Human accept, reject or needs-research decision with reason |
| Job / StepAttempt | Durable workflow execution and retry state |
| ProviderRun / CostEvent | Provider/model usage, latency, cost and outcome |

Optional later research entities such as `BuyerHypothesis` or `ConversationBrief` must not be required by Opportunity Core. Personal contacts, mailboxes, send events and delivery events are outside the target domain.

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

Evidence sources such as websites, maps, directories, reviews, communities or AI answers live in provenance. They do not define the product or silently change the signal type.

## Opportunity assessment

The model returns `QUALIFY`, `REVIEW` or `REJECT` across separate dimensions:

- evidence strength and freshness;
- company-resolution confidence;
- offer and ICP fit;
- commercial impact;
- timing and actionability;
- uncertainty and rejection reasons.

There is no authoritative combined intent score.

## Lifecycle

```text
DISCOVERED
→ EVIDENCE_PENDING
→ ASSESSABLE | INSUFFICIENT_EVIDENCE
→ MODEL_QUALIFIED | MODEL_REVIEW | MODEL_REJECTED
→ HUMAN_REVIEW
→ ACCEPTED | REJECTED | NEEDS_RESEARCH
→ ARCHIVED
```

Models may propose assessments. Deterministic application commands own persistence, state changes, authorization and review decisions.

## Invariants

- Every Opportunity references at least one accessible EvidenceItem.
- Raw evidence and interpretation are stored separately.
- Every claim declares its evidence reference or is explicitly labeled as inference.
- Workspace authority comes from authenticated membership, never client-supplied workspace id.
- Provider payloads are provenance, not canonical domain schemas.
- Reprocessing is idempotent and cannot duplicate an Opportunity or cost event.
- `EN_DISCOVERY_ONLY` exposes only discovery, assessment and review capabilities.
- No workflow state authorizes contact lookup, drafting or sending.
- Existing legacy tables cannot be written by the new Opportunity workflow except through an explicitly temporary migration adapter with a removal date and tests.
