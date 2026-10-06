# Opportunity evaluation strategy

## Purpose

Measure whether IntentLead produces evidence-backed business Opportunities that humans consider useful. Optimize precision and explainability, not candidate volume.

## Evaluation set

Include clear expressed intent, weak pain, non-commercial discussion, wrong company, stale/already-resolved evidence, duplicate evidence, hiring/event signals, review/reputation patterns, competitor changes and ambiguous business identity.

## Required measurements

- reviewer acceptance and agreement;
- false-positive rate and rejection reasons;
- company-resolution accuracy;
- evidence sufficiency, accessibility and freshness;
- unsupported material claims: zero tolerance;
- repeated-run stability;
- cost and latency per accepted Opportunity.

## Review labels

`ACCEPT`, `REJECT` or `NEEDS_RESEARCH`, plus one or more reasons: wrong company, weak evidence, poor offer/ICP fit, stale, already solved, duplicate, low commercial impact, bad timing, unsupported inference, policy concern or other note.

The fixture/no-network gate must prove that external content cannot alter system instructions, create evidence, bypass policy or trigger network/personal-data actions.
