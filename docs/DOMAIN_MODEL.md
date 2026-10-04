# Domain model

**Status:** Accepted target model, 2026-10-04 (ADR-001, ADR-006, ADR-007). Existing code remains a narrower Lead projection during migration. The `EN_DISCOVERY_ONLY` pilot stops before contact enrichment and outreach.

## Aggregate boundaries

`Signal` is an input observation. `Opportunity` is a commercial judgment supported by evidence. `Lead` is a delivery projection after company, buyer and contact work. These terms are not interchangeable.

## Core entities

| Entity | Responsibility |
|---|---|
| Workspace | Tenant, entitlements, budgets and policy scope |
| OfferProfile | What the user sells, outcomes, exclusions and price range |
| ICPDefinition | Target firmographics, geographies, business model, buyer roles and negative criteria |
| MarketProfile | Language, region, providers, legal rules and available capabilities |
| DiscoveryBrief | A bounded search objective; evolves current campaign semantics |
| SourceItem | Normalized immutable observation from a provider |
| EvidenceItem | Auditable fact/artifact with provenance and verification method |
| Company | Resolved organization identity independent of provider payloads |
| Person | Resolved human identity with evidence and confidence |
| Signal | Expressed intent, event, detected problem or visibility/reputation finding |
| Opportunity | Evidence-backed reason this company may be worth contacting for this offer |
| OpportunityAssessment | Separate fit, impact, timing, actionability and confidence dimensions |
| BuyerCandidate | Problem-aware hypothesis about who owns the issue |
| ContactPoint | Email/profile/phone with source and verification state |
| ContactVerification | Provider-independent verification observation and timestamp for a contact point |
| VerificationPolicy | Versioned requirements for declaring a package verified in a market/workflow |
| SuppressionEntry | Minimal policy record that prevents prohibited outreach across campaigns |
| ArtifactMetadata | Hash, storage reference, media type, retention and access metadata for large evidence |
| OutreachDraft | Human-reviewable message whose claims reference evidence ids |
| ReviewDecision | Accepted/rejected/needs-research decision and reason |
| Outcome | Contacted, reply, positive reply, meeting, opportunity, customer or closed |
| Job/StepAttempt | Durable workflow state and retries |
| ProviderRun/CostEvent | Provider, model, latency, usage, cost and outcome |

## Signal taxonomy

```text
EXPRESSED_INTENT
  recommendation_request | comparison | switching | complaint | solution_search | rfp

TRIGGER_EVENT
  hiring | funding | launch | expansion | leadership_change | technology_change

DETECTED_PROBLEM
  website | local_listing | reviews | reputation | acquisition | conversion | operations

VISIBILITY_FINDING
  ai_visibility | citation_gap | competitor_overtake | local_visibility
```

Each subtype defines freshness, evidence and assessment rules. A detected problem must never be relabeled as expressed intent.

## Evidence contract

```ts
type EvidenceItem = {
  id: string;
  workspaceId: string;
  sourceItemId: string | null;
  type: "text" | "structured_fact" | "screenshot" | "document" | "observation";
  sourceUrl: string | null;
  capturedAt: string;
  excerpt: string | null;
  structuredFacts: Record<string, unknown>;
  verificationMethod: string;
  confidence: number;
  contentHash: string;
  provenance: Record<string, unknown>;
};
```

Raw material and interpretation are separate. An evidence item is immutable; corrected interpretations create a new assessment.

## Opportunity assessment

```ts
type OpportunityAssessment = {
  decision: "QUALIFY" | "REVIEW" | "REJECT";
  signalType: string;
  problemType: string;
  problemStatement: string;
  evidenceStrength: number;
  explicitness: number;
  urgency: number;
  freshness: number;
  commercialImpact: number;
  icpFit: number;
  companyConfidence: number;
  buyerRelevance: number;
  actionability: number;
  confidence: number;
  evidenceIds: string[];
  rejectionReasons: string[];
};
```

No single total score is authoritative. Product policy decides which dimensions are mandatory by signal type and market.

## Opportunity lifecycle

```text
DISCOVERED
→ ENRICHING
→ ASSESSABLE | INSUFFICIENT_EVIDENCE
→ PACKAGE_READY | MODEL_REJECTED
→ HUMAN_REVIEW
→ OUTREACH_READY | REJECTED | NEEDS_RESEARCH
→ CONTACTED
→ REPLIED | NO_REPLY | OPTED_OUT
→ POSITIVE_REPLY | NEGATIVE_REPLY
→ MEETING | SALES_OPPORTUNITY | CUSTOMER | CLOSED
```

State transitions are deterministic commands. LLM output can propose an assessment, buyer or draft but cannot directly charge credits, accept an Opportunity, contact a person or mutate terminal outcome state.

## Compatibility path

The current `signals`, `leads` and `messages` tables remain during migration. A ready Opportunity may project into the existing Lead UI. New tables are introduced alongside the old pipeline, populated by the new vertical slice, then old writes are retired after reconciliation and migration tests.

## Invariants

- Every Opportunity references at least one evidence item.
- Every outreach claim references supporting evidence or is explicitly framed as a hypothesis.
- Workspace authority is derived from authenticated membership, never from client-supplied workspace id.
- Contact discovery and contact verification are distinct.
- Under `EN_DISCOVERY_ONLY`, contact discovery/enrichment, outreach-ready transitions and outreach are disabled regardless of generic lifecycle capabilities.
- Current credit usage is attached exactly once to a package that satisfies the explicit verification policy, not to a provider call or model recommendation. Any future human-acceptance billing policy requires a separate decision.
- Suppressed contacts cannot move to outreach-ready state.
- Provider payloads are stored as provenance, not used as canonical domain schemas.
