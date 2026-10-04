# IntentLead product model

**Status:** Accepted by founder, 2026-10-04. Initial pilot scope is `EN_DISCOVERY_ONLY` as specified below.

## Product

IntentLead is an Opportunity Intelligence Engine. It finds businesses with a concrete, defensible reason to contact them, identifies the person most likely to own the problem, verifies a contact path, and prepares an evidence-backed conversation starter for human review.

The product is not a contact database, generic AI SDR, social-listening dashboard, automatic cold-email sender, SEO suite or standalone AI Visibility tracker.

## Core outcome

```text
“Who should I contact?”
→ company
→ observable problem or event
→ evidence
→ commercial relevance and timing
→ buyer hypothesis
→ verified contact path
→ grounded outreach draft
```

## Signal families

### Expressed intent

The subject publicly expresses a need: recommendation request, comparison, complaint, replacement search, manual-process pain or RFP.

### Trigger event

A public event such as hiring, funding, launch, expansion, leadership change or technology change creates a plausible commercial condition without explicitly requesting a solution.

### Detected commercial problem

IntentLead independently detects a problem: missing local presence, inconsistent listings, repeated review issue, website/indexing defect, competitor advantage or another measurable acquisition/conversion/reputation issue.

### Visibility finding

Repeated observations show an AI-answer, search, citation, competitor or local-visibility gap. A visibility finding retains its measurement context and does not become intent.

No signal family proves readiness to buy. Even expressed intent may be non-commercial, stale, already resolved or attributable to the wrong person. Opportunity assessment determines actionability while UI, scoring and outreach preserve the original signal semantics.

## Accepted initial experiment (2026-10-04)

The first product proof is IntentLead self-prospecting under `EN_DISCOVERY_ONLY`: discover companies that fit IntentLead, build evidence-backed Opportunity candidates and let the founder accept/reject them. Contact enrichment and outreach are disabled in this pilot. The full contact/draft/outcome workflow remains a later capability, gated by a jurisdiction-specific profile and separate authorization; this acceptance does not permit real outreach or provider spend.

The next expansion is deliberately uncommitted. After core dogfood and pilot evidence, choose either one jurisdiction-specific local vertical slice or one AI Visibility detector according to user demand, legal/provider feasibility, evidence quality and economics.

## Users and discovery

Existing documents hypothesize growth freelancers, small outbound agencies and founder-led B2B teams. This is not a permanent constraint. Product research and pilots must test who obtains repeatable value, willingness to pay and repeat usage.

## Product promises

- Every commercial claim is traceable to evidence.
- Facts and model interpretations are visibly distinct.
- The user reviews before outreach.
- Rejected and insufficient-evidence candidates are normal outcomes.
- Vendors and regions are replaceable implementation details.
- Cost, freshness, confidence and limitations are visible.

## Non-goals

- Mass autonomous sending.
- LinkedIn automation or ToS evasion.
- A universal CRM.
- A giant proprietary contact database.
- Fifty integrations before source economics are known.
- A single magic intent score.
- Claiming causal business loss from a weak proxy.

## Success model

Early quality proxy: `user-accepted evidence-backed opportunities / delivered opportunities`.

Keep the funnel separate:

- `accepted / delivered` measures Opportunity quality;
- `contacted / accepted` measures activation;
- `qualified positive conversations / contacted` measures outreach yield;
- `qualified positive conversations / delivered` remains the end-to-end business metric.

Guardrails:

- hallucinated commercial facts: 0;
- cross-tenant data exposure: 0;
- credit charged for machine-rejected, failed or duplicate package: 0;
- wrong-company, wrong-buyer, stale-signal and invalid-contact rates tracked separately;
- cost per accepted Opportunity within the pilot budget;
- complaint and opt-out rates monitored.

## Commercial validation stages

1. Internal dogfood: founder reviews real Opportunities.
2. Concierge pilot: 3–5 design partners, human review, manual delivery.
3. Paid pilot: use explicitly approved invoice/subscription/usage terms. Commercial payment is distinct from the internal `PACKAGE_VERIFIED` credit event unless a later decision deliberately connects them.
4. Productized subscription: only after repeat usage and source economics.
5. API/MCP exposure: only after application capabilities and authorization are stable.

## Kill or pivot criteria

Pause a source or vertical if, after a predeclared sample, it has poor acceptance, weak entity resolution, unacceptable legal/platform risk, or cost above the willingness-to-pay envelope. Pause the whole wedge if accepted opportunities do not produce qualified conversations materially better than unsignaled prospecting.
