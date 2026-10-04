# AI Visibility module boundary

## Role

AI Visibility is a bounded intelligence provider inside IntentLead. It observes how a company appears in AI answers, compares competitors/citations, diagnoses evidence-backed gaps, proposes actions, measures before/after and may create an Opportunity candidate. Low visibility alone is not buying intent.

## Lifecycle

```text
discover prompts
→ version portfolio
→ repeated multi-engine observations
→ mentions/citations/competitors metrics
→ finding and diagnosis
→ action/experiment
→ repeated measurement
→ Opportunity assessment when commercially relevant
```

## Data model

Projects, prompt portfolios, prompts, runs, observations, mentions, citations, competitors, metrics, findings, actions, experiments and citation sources/gaps. Raw observation and provider metadata remain auditable. Baseline portfolios are versioned and never rewritten retroactively.

## Measurement rules

- No single visibility score.
- Record engine/surface, prompt, market/language, timestamp, sample size and uncertainty.
- Repeat observations because answers are stochastic.
- Separate observed visibility from website readiness diagnostics.
- Do not infer causality from correlation.
- Compare unchanged prompt cohorts before/after an action.

## Opportunity bridge

Strong candidates combine repeated visibility evidence, commercial prompt intent, sustained competitor advantage, ICP/offer fit, meaningful impact, actionable remediation and an identifiable buyer. Weak or one-off absence remains a finding, not an Opportunity.

## Delivery gate

Do not build the full dashboard before Opportunity Core and dogfood validation. The first experiment should answer whether AI Visibility findings produce accepted Opportunities and conversations better than simpler website/local evidence.
