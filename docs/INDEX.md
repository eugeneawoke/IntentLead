# IntentLead documentation index

**Status date:** 2026-10-06.

Code and migrations define current runtime behavior. The documents below define the accepted Opportunity Intelligence target and execution order. Deleted legacy product documents remain recoverable from Git history but are not project context.

## Required read order

1. [PRODUCT.md](PRODUCT.md) — product boundary and value.
2. [DOMAIN_MODEL.md](DOMAIN_MODEL.md) — Opportunity, evidence and lifecycle.
3. [ARCHITECTURE.md](ARCHITECTURE.md) — modules, runtime and migration path.
4. [ROADMAP-V2.md](ROADMAP-V2.md) — outcome-based product stages.
5. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — active engineering sequence.
6. [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md) — concise priorities.
7. [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) — dated implementation baseline; verify drift against code.

## Engineering and governance

- [CAPABILITY_MAP.md](CAPABILITY_MAP.md)
- [TEST_STRATEGY.md](TEST_STRATEGY.md)
- [AI_EVALUATION_STRATEGY.md](AI_EVALUATION_STRATEGY.md)
- [SECURITY_THREAT_MODEL.md](SECURITY_THREAT_MODEL.md)
- [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md)
- [OBSERVABILITY_AND_COSTS.md](OBSERVABILITY_AND_COSTS.md)
- [PROVIDER_MATRIX.md](PROVIDER_MATRIX.md)
- [MARKET_PROFILES.md](MARKET_PROFILES.md)
- [INTEGRATION_HEALTH.md](INTEGRATION_HEALTH.md)
- [DEVELOPER_RUNBOOK.md](DEVELOPER_RUNBOOK.md)
- [AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md](AUTONOMOUS_IMPLEMENTATION_RUNBOOK.md)
- [AGENT_OPERATING_MODEL.md](AGENT_OPERATING_MODEL.md)
- [USER_ACTIONS.md](USER_ACTIONS.md)

## Optional integration and transport boundaries

- [GLOOK_INTEGRATION.md](GLOOK_INTEGRATION.md) — dormant optional snapshot adapter; not a pilot dependency.
- [MCP_ARCHITECTURE.md](MCP_ARCHITECTURE.md) — future transport over stable application capabilities.

## Active architectural decisions

- [ADR-001: Opportunity core](adr/001-opportunity-core.md)
- [ADR-002: Optional Glook contract boundary](adr/002-glook-contract-boundary.md)
- [ADR-003: Durable jobs](adr/003-durable-job-model.md)
- [ADR-004: Provider and market abstraction](adr/004-provider-market-abstractions.md)
- [ADR-006: Evidence provenance](adr/006-evidence-provenance.md)
- [ADR-008: Shared database namespace](adr/008-shared-database-namespace.md)
- [ADR-009: Human-controlled Opportunity package](adr/009-human-controlled-opportunity-package.md)

ADR-005 (committed AI Visibility module) and ADR-007 (verified-package credit charging) were removed on 2026-10-06. AI Visibility remains an optional signal provider; pricing/credits are undecided. ADR-009 restores buyer/contact/draft as a human-controlled Opportunity package without reviving credit or sending semantics.

## Authority rules

- Opportunity is the only target commercial aggregate.
- Website reading may establish business identity/context; technical, SEO and AI-readiness auditing is outside accepted product scope.
- Glook and AI Visibility are not prerequisites or committed near-term modules.
- Buyer resolution, verified business contacts and evidence-grounded conversation briefs/drafts are subordinate parts of an Opportunity package.
- Sending, mailbox automation, sequences, follow-ups and delivery tracking are permanently outside product scope.
- New product or architecture decisions update PRODUCT, DOMAIN_MODEL, ARCHITECTURE, ROADMAP and an ADR when durable rationale is needed.
