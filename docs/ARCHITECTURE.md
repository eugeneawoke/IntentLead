# IntentLead target architecture

**Status:** Accepted, corrected 2026-10-06.

## Decision

Evolve the existing application into a modular Opportunity Intelligence system with Next.js for UI/API, a Railway worker for durable workflows and Supabase PostgreSQL/Auth for authoritative state. Preserve the existing modular-monolith deployment model and the established Signal Dark interface. Do not rewrite the repository into microservices or replace proven infrastructure.

## Runtime flow

```text
UI / REST / future MCP
        ↓
authenticated application capabilities
        ↓
DiscoveryBrief + MarketProfile + budget policy
        ↓
source planning and durable workflow
        ↓
source adapters → normalization → evidence
        ↓
company resolution → Opportunity assessment
        ↓
buyer resolution → contact discovery/verification
        ↓
grounded brief/draft → human review/export
```

There is no send step. A human may copy/export the package and act outside IntentLead.

## Core modules

```text
identity-workspace
offers-icp
market-profile
discovery-briefs
source-planning
provider-registry
jobs
source-ingestion
evidence
company-resolution
opportunity-assessment
buyer-resolution
contact-discovery
contact-verification
conversation-briefs
human-review
feedback-evaluation
observability-cost
```

Transport layers call the same application services. UI, REST, workers and future MCP do not own parallel business logic.

## Source planning and adapters

Domain services request capabilities rather than vendors. A `SourcePlanner` chooses a bounded set from the `ProviderRegistry` using:

- offer and ICP;
- business type and signal families;
- market, geography and language;
- access/legal status;
- provider health and credentials;
- expected quality, freshness, latency and cost;
- requested result count and budget.

Provider capability families include `PUBLIC_POST_SEARCH`, `WEB_SEARCH`, `REVIEWS`, `JOB_SEARCH`, `NEWS_SEARCH`, `MAP_SEARCH`, `LOCAL_BUSINESS_SEARCH`, `WEBSITE_FETCH`, `CONTENT_EXTRACTION`, `COMPANY_ENRICHMENT`, `PERSON_SEARCH`, `EMAIL_FIND` and `EMAIL_VERIFY`.

The registry must support `OFFICIAL_API`, `PARTNER_API`, `SEARCH_INDEX`, `PUBLIC_WEB`, `AUTHORIZED_SCRAPING`, `MANUAL_ONLY` and `UNAVAILABLE`. Missing credentials degrade to another allowed provider or an explicit capability gap; they do not block unrelated steps.

## Business analysis boundary

IntentLead analyzes the business as a whole. A website is one evidence surface for identity, product, audience, positioning, public contacts and offer-relevant observations.

Technical, SEO or AI-readiness auditing is never a universal mandatory pipeline. A specific technical observation may become evidence only when the user's offer makes it commercially relevant and the observation is directly verifiable.

## Buyer, contact and draft boundary

Buyer resolution depends on the problem, offer, company size, industry and market; there is no rigid global role allowlist.

Contact discovery proceeds from cheap deterministic sources to bounded provider fallbacks. Each contact retains source, observed role, verification method, timestamp, confidence, market policy and cost. Personal/contact data is minimized and protected by RLS and retention policy.

Conversation briefs and drafts are derived from evidence references. The application can copy/export them but cannot connect a mailbox, send, sequence, follow up or track delivery.

## Application capabilities

Near-term capabilities are:

- create and update OfferProfile and ICPDefinition;
- create a DiscoveryBrief with market, source policy, target count and budget;
- start, inspect and cancel a discovery job;
- inspect source plan, provider health, cost and limitations;
- list and inspect signals, companies, Opportunities and evidence;
- inspect buyer candidates and verified contacts;
- generate/copy an evidence-grounded brief or draft;
- record review decisions, rejection reasons and optional human-reported outcomes;
- delete/redact a discovery brief and its owned data.

Mailbox access, sending, sequencing, follow-ups and delivery tracking are not application capabilities.

## Durable jobs

```text
QUEUED → LEASED → RUNNING → RETRY_WAIT
       → COMPLETED | PARTIAL | FAILED | CANCELLED
```

Workers use bounded leases, heartbeat, step checkpoints and idempotent writes. Dispatch succeeds only after the job is committed. Every provider/model attempt records schema version, timeout, result, cost and provenance.

The workflow is cost-aware: cheap discovery and qualification precede company research; company/ICP qualification precedes buyer/contact enrichment; contact verification precedes draft generation.

## Reasoning and agent boundary

Deterministic code owns authorization, state transitions, deduplication, idempotency, provider selection, budgets, persistence and policy gates.

Bounded reasoning roles are:

- Source Discovery: propose where and how to search;
- Research: collect company and market context;
- Signal Analyst: interpret the observed condition;
- Opportunity Analyst: assess offer/ICP fit, impact and timing;
- Entity Resolution: resolve ambiguous company/person matches;
- Buyer Resolution: rank likely responsible roles/people;
- Evidence Verification: validate claims and provenance;
- Drafting: create a grounded conversation angle;
- Policy Guard: enforce market/source/contact rules.

These are typed steps or capabilities, not an unconstrained swarm.

## Migration strategy

1. Correct canonical docs and eval gates.
2. Restore the established visual layer selectively without reviving obsolete claims or send controls.
3. Reintroduce versioned BuyerCandidate, ContactPoint, ContactVerification, ConversationBrief and Draft contracts.
4. Add forward-only `intentlead_` schema for those entities; never rewrite applied migrations.
5. Restore/rebuild historical contact-provider code behind the current registry, budget and policy boundaries.
6. Extend `EN_DISCOVERY_ONLY` to research through verified contact and grounded draft while denying all external action.
7. Add source planning and free/legal provider adapters for global and CIS/local profiles.
8. Run a reproducible minimum-20-signal self-prospecting evaluation.

## Cross-cutting requirements

- RLS and negative cross-tenant tests for every tenant entity.
- External content is untrusted and cannot alter system instructions.
- Provider calls have explicit timeout, retry, budget, legal/access and credential status.
- Structured logs exclude secrets and unnecessary personal data.
- Evidence stores source, capture time, content hash, verification method and provenance.
- Contact storage has minimization, deletion, suppression and provenance rules.
- No paid/network provider path runs without its explicit gate; free live providers still require configured credentials and legal access.
- No production deploy/migration and no outbound action in the current authorized stage.
- No Kafka, Kubernetes or separate database until measured load justifies it.
