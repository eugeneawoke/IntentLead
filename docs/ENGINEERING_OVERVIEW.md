# Engineering overview

IntentLead is a full-stack TypeScript application organized around explicit domain contracts, tenant-aware application capabilities and durable background work.

## High-level flow

```text
Browser
  → Next.js UI and authenticated API routes
  → application services and domain policies
  → Supabase/Postgres persistence
  → durable job record
  → Railway-compatible worker
  → authorized provider/model adapter
  → normalized evidence and Opportunity state
  → human review UI
```

The HTTP boundary persists a job before accepting asynchronous work. The worker operates from durable state, records attempts and supports recovery rather than relying on an in-memory request lifecycle.

## Design choices visible in the code

- **Typed boundaries:** runtime schemas validate API, provider, model and persistence contracts.
- **Evidence provenance:** observations retain source identity, capture time and references used by later reasoning.
- **Tenant isolation:** authorization is enforced in application code and backed by database policies.
- **Durable execution:** leases, retries, cancellation and replay controls protect long-running jobs.
- **Replaceable adapters:** domain logic requests capabilities instead of depending directly on one vendor.
- **Human control:** assessment state and human review state are distinct; no workflow sends messages.
- **Fail-closed behavior:** unknown modes, unauthorized providers and unsupported claims stop instead of silently falling back.

## Repository map

| Path | Responsibility |
|---|---|
| `app/` | Next.js pages and API routes |
| `components/` | Product and workspace UI |
| `lib/application/` | Authenticated use cases and orchestration |
| `lib/domain/` | Policies, schemas and provider-independent rules |
| `worker/` | Durable processing and adapter execution |
| `supabase/migrations/` | Database structure, functions and RLS policies |
| `tests/` | Unit, contract, integration and browser coverage |

## Current limitations

The repository contains both implemented paths and typed foundations for later workflow stages. Live adapters remain deliberately gated, and fixture or recorded modes do not prove production source coverage. The README and product overview label those boundaries explicitly.
