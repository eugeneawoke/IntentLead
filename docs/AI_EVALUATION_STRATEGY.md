# Opportunity package evaluation strategy

## Purpose

Measure whether IntentLead produces evidence-backed, contact-worthy Opportunity packages that humans consider useful. Optimize precision, groundedness and repeatability without hiding insufficient coverage.

## Capability evals

1. Source planning selects appropriate legal/free source families for global SaaS, CIS SaaS, local service and agency briefs.
2. A full-size recorded corpus yields at least 20 confirmed signals when sufficient valid evidence exists.
3. Duplicate, stale, wrong-company and weak candidates do not count toward the target.
4. Company and buyer resolution expose ambiguity rather than forcing a match.
5. Every delivered contact has evidence, source, freshness and a separate verification state.
6. No contact, email, role or person is invented.
7. Every material factual draft claim maps to evidence ids.
8. Prompt injection cannot alter system policy, create evidence, invoke providers or produce external action.
9. A short corpus returns `PARTIAL` with funnel counts instead of padding.
10. No route, capability, provider or worker step can send a message.
11. Conversational intake preserves user meaning, exposes inferred constraints for review and asks rather than invents when required fields are absent.
12. Model output cannot create evidence, authorize a paid provider or change budget/source policy.
13. Paid-locked providers remain unreachable even when credentials are present.

## Evaluation set

Include clear expressed intent, weak pain, non-commercial discussion, wrong company, wrong person, stale/already-resolved evidence, duplicate evidence, hiring/event signals, review/reputation patterns, competitor changes, local-business observations, contact unavailable/invalid cases and adversarial source text.

## Required measurements

- raw candidates, confirmed signals, unique companies and complete packages;
- reviewer acceptance and agreement;
- false-positive rate and structured rejection reasons;
- company-resolution accuracy;
- buyer-resolution accuracy;
- contact coverage and verification accuracy;
- evidence sufficiency, accessibility and family-specific freshness;
- draft claim-to-evidence coverage;
- unsupported material claims: zero tolerance;
- repeated-run stability;
- source mix, provider failures/fallbacks, cost and latency per accepted package.

## Review labels

`ACCEPT`, `REJECT` or `NEEDS_RESEARCH`, plus one primary reason: wrong company, wrong person, invalid/unverified contact, weak evidence, poor offer fit, poor ICP fit, stale, already solved, duplicate, low commercial impact, bad timing, unsupported inference, policy concern or other note.

## Graders

- code graders for schemas, counts, evidence links, RLS, no-send and idempotency;
- rule graders for unsupported fields/claims and provider/cost constraints;
- bounded model graders for open-ended relevance and draft quality;
- human review for ambiguous commercial usefulness and visual WOW.

Synthetic fixtures prove contracts only. Recorded or authorized real evidence is required before claiming live product quality.
