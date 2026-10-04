# ADR-003: Postgres-backed durable job model

**Status:** Accepted by founder, 2026-10-04; no amendments.

## Decision

Use Supabase/Postgres job rows, atomic leases, heartbeats, checkpoints and idempotent step attempts before considering a separate queue.

## Consequences

Current Railway deployment remains. Job recovery and transport-independent async capabilities become possible. Additional schema and integration tests are required; Kafka/Redis are not introduced without measured need.
