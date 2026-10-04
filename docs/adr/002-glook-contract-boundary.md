# ADR-002: Glook integration uses a versioned contract

**Status:** Accepted by founder, 2026-10-04; no amendments.

## Decision

Replace direct service-role reads of Glook internal tables with an authenticated versioned SiteContextSnapshot API or signed event. Shared Supabase/Auth may remain infrastructure.

## Consequences

Ownership and schema version become explicit. Both repositories need contract tests and a transition period. Glook readiness findings cannot silently become visibility or buying-intent claims.
