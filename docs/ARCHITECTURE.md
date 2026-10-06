# IntentLead target architecture

**Status:** Accepted, revised 2026-10-06.

## Decision

Evolve the existing application into a modular Opportunity Intelligence system with Next.js for UI/API, a Railway worker for durable workflows and Supabase PostgreSQL/Auth for authoritative state. Do not rewrite the repository into microservices.

## Runtime flow

```text
UI / REST / future MCP
        ↓
authenticated application capabilities
        ↓
durable workflow and policy
        ↓
Opportunity domain services
        ↓
normalization + evidence + company resolution
        ↓
business-intelligence source adapters
        ↓
Postgres/Auth + authorized external sources
```

## Core modules

```text
identity-workspace
offers-icp
market-profile
discovery-briefs
provider-registry
jobs
source-ingestion
evidence
company-resolution
opportunity-assessment
human-review
feedback-evaluation
observability-cost
```

Transport layers call the same application services. UI, REST, workers and MCP do not own parallel business logic.

## Source-adapter boundary

IntentLead analyzes a business through multiple evidence surfaces. Adapters may collect public intent, company events, hiring, reviews, market/competitor changes, directories or other observable commercial conditions.

A company website may be read only to establish business identity and context: products, audience, positioning, market and public claims. Technical, SEO or AI-readiness auditing is outside the accepted product scope and roadmap.

Glook is an optional future adapter. If enabled, it may provide a versioned, owner-authorized snapshot. Opportunity Core never reads Glook internal tables and never treats a Glook interpretation as commercial truth.

## Application capabilities

Near-term capabilities are:

- create and update OfferProfile and ICPDefinition;
- create a DiscoveryBrief;
- start, inspect and cancel a discovery job;
- list and inspect Opportunities and EvidenceItems;
- record ReviewDecision and rejection reason;
- delete/redact a discovery brief and its owned data;
- inspect provider health, provenance, cost and limitations.

Contact lookup, mailbox access, sending, sequencing and delivery tracking are not application capabilities. A later explicit product decision may add a copyable conversation brief without changing that boundary.

## Durable jobs

```text
QUEUED → LEASED → RUNNING → RETRY_WAIT
       → COMPLETED | PARTIAL | FAILED | CANCELLED
```

Workers use bounded leases, heartbeat, step checkpoints and idempotent writes. Dispatch succeeds only after the job is committed. Every provider/model attempt records schema version, timeout, result, cost and provenance.

## Reasoning boundary

Deterministic code owns authorization, state transitions, deduplication, idempotency, provider selection, budgets and persistence. Models may perform bounded, typed interpretation of observed facts, ambiguous company resolution and Opportunity assessment. Model output cannot create evidence, accept an Opportunity or invoke external action.

## Migration strategy

1. Keep the verified Opportunity tables, jobs, provider registry and review UI.
2. Remove unused legacy pipeline, lead API/UI, message generation and active Glook direct reads.
3. Add native OfferProfile, ICPDefinition and DiscoveryBrief commands so new execution no longer depends on `campaigns`.
4. Wire the self-prospecting handler to the worker in an explicit fixture/no-network/zero-cost mode.
5. Replace legacy lifecycle synchronization and foreign keys with native `intentlead_*` ownership.
6. Add an additive cleanup migration that removes obsolete `campaigns`, `signals`, `leads`, `messages` and credit RPCs only after fresh-database and upgrade tests pass.
7. Run the controlled self-prospecting sample and quality review.

Applied migrations are never rewritten. Legacy removal uses new additive migrations and tested rollback/reconciliation.

## Cross-cutting requirements

- RLS and negative cross-tenant tests for every tenant entity.
- External content is untrusted.
- Provider calls have explicit timeout, retry, budget and legal/access status.
- Structured logs exclude secrets and unnecessary personal data.
- Evidence stores source, capture time, content hash, verification method and provenance.
- The first pilot has no paid/network provider path unless separately authorized.
- No Kafka, Kubernetes or separate database until measured load justifies it.
