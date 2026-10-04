# ADR-008: IntentLead owns a prefixed namespace in shared Supabase

**Status:** Accepted by founder, 2026-10-04; no amendments. Actual shared-project identity must still be confirmed before migration.

## Context

IntentLead and Glook are expected to share one Supabase project. Generic new tables and RPC names would create ownership, migration and privilege ambiguity between repositories. A separate Postgres schema would require deliberate PostgREST exposure and client configuration that the current application does not have.

## Decision

Keep the first migration in the currently exposed application schema but prefix every new IntentLead-owned table, view, sequence, trigger and RPC with `intentlead_`. This repository is the sole migration owner for that namespace. Cross-product access occurs only through versioned contracts, not shared internal tables.

Every security-definer RPC must:

- declare a fixed safe `search_path`;
- revoke default `PUBLIC EXECUTE`;
- grant execution only to the required authenticated/service role;
- derive or validate tenant ownership inside SQL;
- validate lease owner/token or idempotency identity inside the transaction;
- have real negative privilege and cross-tenant tests.

## Consequences

Names are longer but deployment does not depend on changing exposed-schema settings. A later dedicated schema remains possible through an explicit migration ADR. No migration may create generic `companies`, `evidence`, `jobs` or similarly collision-prone objects in the shared project.
