# ADR-010: Free-first provider and model rollout

**Date:** 2026-10-08
**Status:** accepted
**Deciders:** founder and implementation agent

## Context

IntentLead needs a broad catalog of global, CIS and local sources, but early product validation must not depend on paid search or contact-enrichment APIs. The product also needs an LLM-guided intake and analysis layer without allowing model output or external content to bypass evidence, policy or budget controls.

## Decision

Build the provider catalog and capability contracts for the full source portfolio, then enable integrations in layers. The first working portfolio uses legal free/public sources and recorded evidence; paid search and contact providers remain `paid_locked` or `disabled` until user demand and delivery economics justify activation.

The LLM is a replaceable model provider behind typed reasoning capabilities. It may structure user requests, propose source plans, interpret evidence, rank buyer hypotheses and draft grounded text. It cannot create evidence, select unauthorized providers, exceed budgets or perform external actions.

## Alternatives considered

### Rebuild every historical provider immediately

- **Benefit:** broad nominal coverage quickly.
- **Cost:** premature credential, pricing, policy and maintenance burden before product demand is known.
- **Rejected because:** adapter count would be mistaken for product value and could introduce unapproved spend.

### Hard-code one free source and one LLM

- **Benefit:** smallest initial implementation.
- **Cost:** recreates the single-source architecture and couples product behavior to one model vendor.
- **Rejected because:** IntentLead must select sources by offer, market and signal family.

### No model until all source adapters exist

- **Benefit:** purely deterministic early pipeline.
- **Cost:** prevents natural-language intake and bounded reasoning over evidence.
- **Rejected because:** the model layer is part of the intended product interaction, provided it remains evidence- and policy-bound.

## Consequences

### Positive

- The complete provider landscape is visible without implying that every integration is active.
- Free/legal paths can prove product usefulness before paid-provider costs are introduced.
- Search, contact enrichment and LLM spend share explicit budgets and activation gates.
- Model vendors can be changed without rewriting the domain workflow.

### Negative

- Some catalog entries remain unavailable or fixture-only for longer.
- Initial coverage can be lower than a paid enrichment stack.
- Source-specific legal/access checks are still required before every live enablement.

### Risks

- A free tier may change or be exhausted; quotas are treated as finite budgets and revalidated before live use.
- Model output may sound authoritative; only referenced evidence can support material claims.
- A catalog entry may be confused with a working integration; runtime state and documentation must distinguish `implemented`, `fixture_only`, `planned`, `missing_credentials`, `paid_locked`, `manual_only`, `disabled` and `unavailable`.
