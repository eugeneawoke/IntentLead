# Research synthesis and evidence policy

Status date: 2026-10-04.

This document reconciles the supplied market research, field notes, architecture audits and product prompts. It records what may guide product decisions and what still needs validation. It is not a market report and does not upgrade secondary claims into facts.

## Materials reviewed

- `deep-research-report (6).md` — public buyer-intent and signal-based lead generation.
- `deep-research-report (7).md` — current relevance of IntentLead, intent-provider landscape and multichannel outreach patterns.
- `Конспект_5_шагов_поиска_клиентов.md` — evidence-first manual outbound and local-business discovery workflow.
- `Конспект_что_покупает_бизнес_2026.md` — local observable problems, business outcomes and risk framing.
- `glook-architecture-audit-2026-09-03.md` — current Glook boundaries and technical debt.
- `intentlead-ai-visibility-module-architecture.md` — AI Visibility as a future evidence source.
- The two supplied implementation and roadmap prompts — target constraints and audit questions, not proof of current implementation.

## Stable synthesis

The durable product category is **public-signal opportunity intelligence for B2B prospecting**.

The system turns public evidence into a reviewable commercial opportunity:

```text
public signal → evidence → entity resolution → problem/intent interpretation
→ likely buyer role → verified contact → grounded outreach → outcome feedback
```

This definition intentionally keeps four signal families distinct:

1. **Expressed intent** — a person or company explicitly asks, compares, complains, researches or seeks a solution.
2. **Trigger event** — hiring, funding, launch, expansion, leadership or technology change creates a plausible commercial condition without stating a need.
3. **Detected commercial problem** — a public surface reveals a verifiable gap, such as weak local presence, repeated negative reviews or a broken conversion path.
4. **Visibility finding** — repeated measurements show an AI, search, citation or local-visibility gap.

No signal family proves purchase readiness. Even expressed intent may be non-commercial, stale, already solved or emitted by the wrong person. Readiness is an Opportunity assessment supported by evidence; product copy, scoring and outreach must preserve the original signal semantics.

## Cross-source findings worth building around

### Evidence before automation

The strongest common pattern is evidence-first outreach: identify a concrete public fact, verify it, connect it to an economically meaningful problem, and only then produce a contact and message. A high-volume list without inspectable evidence is not the product's quality bar.

### Freshness is part of quality

Signals decay at different speeds. A recent request for a vendor and a six-month review trend cannot share the same freshness rule. Each detector needs an explicit timestamp, freshness window and stale-state behavior.

### Fit and intent are different scores

Company fit answers “is this account relevant?” Intent or problem confidence answers “does the evidence support action now?” They must be stored and explained separately before any combined ranking is introduced.

### Local discovery is a separate playbook

Maps, websites and reviews require geography, category, listing identity and local compliance rules. They should use the same Opportunity core but a dedicated market profile and detector set, not be mixed into the Reddit/HN classifier.

### Outcome feedback is mandatory

The system cannot improve from accepted leads alone. It needs rejection reasons, message edits, sends, replies, qualified conversations and customer outcomes, tied back to detector, source, market and cost.

## Claims that remain hypotheses

The following may inform experiments but must not be used as verified benchmarks until their primary sources, dates and methodologies are recorded:

- market-size, response-rate, conversion-rate and ROI numbers copied into the research reports;
- claims about which channel or persona is universally best;
- the field funnel `100 messages → 6 replies → 5 interested → 2 purchases` as a general expectation;
- conclusions that a visible problem implies active purchase intent;
- provider coverage, accuracy or deliverability beyond a dated integration test.

## Product implications

| Finding | Product decision | Validation needed |
|---|---|---|
| Public evidence is the defensible unit | Make Evidence and Opportunity first-class records | Human review of evidence sufficiency |
| Sources express different semantics | Detector-specific contracts and score reasons | Calibrated labeled samples per detector |
| Local and community workflows differ | Market profiles, policy profiles and separate playbooks | One narrow pilot in each selected market |
| Buyer role depends on the problem | Problem-aware buyer resolution | Expert review and reply outcomes |
| Contact data is not the same as a lead | Separate discovery, verification and eligibility states | Bounce and deliverability measurements |
| Outreach must be grounded | Every material claim references evidence | Unsupported-claim evaluation set |
| Learning requires outcomes | Add review and outcome events before scaling sources | Sufficient sample size and clear labels |

## Initial validation sequence

1. Reprocess a small frozen Reddit/HN corpus into Evidence and Opportunity records.
2. Have a human reviewer label relevance, evidence sufficiency, problem/intent class, buyer-role plausibility and outreach safety.
3. Run a narrow pilot with explicit acceptance and qualified-reply metrics.
4. After the core pilot, select one expansion experiment from measured demand and feasibility: a local-market detector or an AI Visibility detector. Each requires its own labeled sample, access/compliance review and economic gate.
5. AI Visibility additionally requires a stable Glook contract boundary and reproducible source snapshots.

## Research governance

- Every external factual claim stores source URL, publication date, access date and methodology where available.
- Every product conclusion is tagged as verified fact, implementation observation, research-supported hypothesis or founder decision.
- A generated explanation never outranks raw evidence.
- A detector is not promoted to production because it produced persuasive examples; it must pass a labeled evaluation and an economic gate.
- Future research should discover viable segments and audiences rather than encode them as foregone conclusions.
