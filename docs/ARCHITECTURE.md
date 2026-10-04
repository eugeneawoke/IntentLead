# Target architecture

**Status:** Accepted target architecture, 2026-10-04 (ADR-001–008). The first pilot is `EN_DISCOVERY_ONLY`; contact enrichment and outreach capabilities remain disabled for its execution.

## Decision

Evolve the current application as a modular monolith with two runtime contours: Next.js for UI/API and a Railway worker for durable workflows. Do not start with microservices or a repository rewrite.

## Logical layers

```text
Web UI / REST API / internal agents / future MCP adapter
                         ↓
Application capabilities and authorization
                         ↓
Durable workflow orchestration and policy
                         ↓
Opportunity domain services
                         ↓
Normalization, evidence and entity resolution
                         ↓
Source/provider adapters
                         ↓
Supabase Postgres/Auth + external providers
```

Transport layers call the same application services. REST, UI, agents and MCP must not own independent business logic.

## Bounded modules

The initial physical layout can remain under current folders, but dependencies must converge toward these boundaries:

```text
modules/
  identity-entitlements
  workspace
  offers-icp
  market-profile
  provider-registry
  jobs
  source-ingestion
  evidence
  entity-resolution
  opportunity
  buyer-resolution
  contact-enrichment
  outreach
  feedback-evaluation
  ai-visibility
  glook-bridge
shared/
  contracts
  validation
  observability
  cost-control
```

Folder moves are not a milestone. Stable typed contracts and dependency direction are.

## Application capabilities

Examples: start opportunity search, get job, list/get Opportunity, research company, resolve buyer, verify contact, draft outreach, record review, record outcome. Each capability:

- derives workspace from auth context;
- validates input with a versioned schema;
- supports idempotency for mutations;
- declares cost class and budget ceiling;
- returns provider-independent errors;
- includes trace id, provenance references and limitations;
- performs no transport-specific redirects or response formatting.

## Durable jobs

Replace in-memory background execution with Postgres-backed jobs:

```text
QUEUED → LEASED → RUNNING → RETRY_WAIT → COMPLETED | PARTIAL | FAILED | CANCELLED
```

Workers lease a job with expiration, heartbeat while running, checkpoint each step, and resume idempotently. Dispatch succeeds only after a job row is committed. A stale lease is recoverable. Each step records attempt, schema version, provider run ids, timeout, retry reason and cost.

## Provider architecture

Domain code requests a capability, not a vendor. Registry selection considers market, language, availability, legal status, reliability, cost and workspace policy. Required interfaces include source search, web fetch/extraction, company resolution, people search, email find, email verify, AI answer observation and model inference.

## Reasoning boundary

Use deterministic code for authorization, state transitions, dedupe, idempotency, provider selection, budgets, evidence persistence and charging. Use models only for bounded analysis with typed outputs: problem interpretation, ambiguous entity resolution, opportunity assessment, buyer hypothesis, grounded outreach and AI Visibility diagnosis.

## Data migration strategy

1. Add new tables without changing existing reads.
2. Introduce application services and adapters around current Reddit/HN and enrichment code.
3. Produce Opportunities and compatibility Lead projections in the dogfood flow.
4. Compare old/new outputs on recorded fixtures.
5. Move UI to Opportunity reads.
6. Stop legacy writes only after parity and rollback proof.

Because Supabase is expected to be shared with Glook, every new database object uses the `intentlead_` prefix under accepted ADR-008. This repository owns those migrations. Security-definer RPCs fix `search_path`, revoke public execution, grant the minimum role and enforce tenant/lease identity inside SQL.

## Cross-cutting requirements

- RLS on every tenant table with negative cross-tenant tests.
- Service role limited to narrow server modules.
- URL fetching protected against SSRF, redirects to private addresses and DNS rebinding.
- External content always untrusted.
- Structured logs exclude secrets, emails and unnecessary raw personal content.
- Every provider call has timeout, retry budget, rate-limit mapping and cost record.
- Schema versions are stored with source items, evidence, assessments and jobs.

## Deployment direction

- Vercel: web app and short authenticated capability endpoints.
- Railway: job workers and controlled scheduled work.
- Supabase: authoritative relational state, job leases, RLS and audit metadata.
- Object storage, if required: screenshots/large evidence artifacts referenced by hash and signed access.

No Kafka, Kubernetes or separate database is justified until measured workload requires it.
