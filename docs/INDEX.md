# IntentLead documentation index

Status date: 2026-10-04.

This is the accepted canonical documentation set for Opportunity Core (founder decision: 2026-10-04). Code and migrations define current behavior; [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) is a dated baseline, not a substitute for a fresh check. [PRODUCT.md](PRODUCT.md), [DOMAIN_MODEL.md](DOMAIN_MODEL.md), [ARCHITECTURE.md](ARCHITECTURE.md) and accepted ADR-001–008 define the target. [ROADMAP-V2.md](ROADMAP-V2.md) sets sequence; [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) is the immediate task plan, with [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md) as the broader backlog. If target documents disagree, resolve the conflict before implementation rather than falling back to historical root text.

The first pilot is self-prospecting under `EN_DISCOVERY_ONLY`: discovery and human Opportunity review are allowed; contact enrichment and outreach are disabled. `PACKAGE_VERIFIED` remains the atomic, owner-validated, idempotent customer-credit trigger, distinct from human review and commercial payment. No production deploy/migration, real outreach, paid API call, billing mutation or provider spend is authorized by this acceptance.

## Read order

1. [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) — verified implementation baseline and contradictions.
2. [PRODUCT.md](PRODUCT.md) — product boundary, users, value and validation gates.
3. [DOMAIN_MODEL.md](DOMAIN_MODEL.md) — Signal, Evidence, Opportunity, Buyer, Contact and lifecycle.
4. [ARCHITECTURE.md](ARCHITECTURE.md) — target modular architecture and migration strategy.
5. [CAPABILITY_MAP.md](CAPABILITY_MAP.md) — current-to-target capability inventory.
6. [ROADMAP-V2.md](ROADMAP-V2.md) — value-based sequencing.
7. [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md) — executable backlog derived from the roadmap.
8. [RESEARCH_SYNTHESIS.md](RESEARCH_SYNTHESIS.md) — reconciled findings, hypotheses and evidence policy.
9. [PILOT_VALIDATION_PROTOCOL.md](PILOT_VALIDATION_PROTOCOL.md) — preregistration template for experiments and commercial gates.

## Engineering and autonomous execution

- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — task-by-task first implementation milestone.
- [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md)
- [AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md](AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md)
- [TEST_STRATEGY.md](TEST_STRATEGY.md)
- [AI_EVALUATION_STRATEGY.md](AI_EVALUATION_STRATEGY.md)
- [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md)
- [OBSERVABILITY_AND_COSTS.md](OBSERVABILITY_AND_COSTS.md)
- [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md)
- [DEVELOPER_RUNBOOK.md](DEVELOPER_RUNBOOK.md)
- [DOCUMENTATION_CLEANUP.md](DOCUMENTATION_CLEANUP.md)

## Integrations and expansion boundaries

- [PROVIDER_MATRIX.md](PROVIDER_MATRIX.md)
- [MARKET_PROFILES.md](MARKET_PROFILES.md)
- [GLOOK_INTEGRATION.md](GLOOK_INTEGRATION.md)
- [AI_VISIBILITY_MODULE.md](AI_VISIBILITY_MODULE.md)
- [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md)
- [INTEGRATION_HEALTH.md](INTEGRATION_HEALTH.md)

## Founder-owned setup

- [USER_ACTIONS.md](USER_ACTIONS.md) — credentials, external accounts, validation samples and connection instructions.

## Architectural decisions

- [adr/001-opportunity-core.md](adr/001-opportunity-core.md)
- [adr/002-glook-contract-boundary.md](adr/002-glook-contract-boundary.md)
- [adr/003-durable-job-model.md](adr/003-durable-job-model.md)
- [adr/004-provider-market-abstractions.md](adr/004-provider-market-abstractions.md)
- [adr/005-ai-visibility-boundary.md](adr/005-ai-visibility-boundary.md)
- [adr/006-evidence-provenance.md](adr/006-evidence-provenance.md)
- [adr/007-credit-idempotency.md](adr/007-credit-idempotency.md)
- [adr/008-shared-database-namespace.md](adr/008-shared-database-namespace.md)

## Historical documents

The following remain useful as history but are not current execution plans: root `PLAN.md`, `TODO.md`, `SPEC.md`, `MEMORY.md`, `DECISIONS.md`, `EVIDENCE.md`, `PROJECT_IDEA.md`, `MASTER_BUILD_PROMPT.md`, `intentlead_mvp_scope.md`, and `AI_MODELS_AUDIT.md`. Preserve their rationale; their current-state claims, old domain model and phase numbering are not authoritative. `AGENTS.md` and `CLAUDE.md` are active agent instructions but do not override the accepted product/architecture/ADR/roadmap set. `DESIGN_SYSTEM.md` remains the UI visual reference until revised.

## Governance

- Product or domain changes update PRODUCT, DOMAIN_MODEL and an ADR.
- Architecture changes update ARCHITECTURE, CAPABILITY_MAP and an ADR.
- Roadmap changes update ROADMAP-V2; implementation detail belongs in IMPLEMENTATION_BACKLOG.
- Measured facts go to CURRENT_STATE_AUDIT or EVIDENCE with date and reproduction command.
- No agent may silently promote a research claim into a verified product fact.
