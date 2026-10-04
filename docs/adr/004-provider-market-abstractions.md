# ADR-004: Provider registry and MarketProfile

**Status:** Accepted by founder, 2026-10-04; no amendments.

## Decision

Domain services request capabilities. A central registry selects providers using MarketProfile, legal/access status, cost, health and quality. Vendors and country conditionals do not enter domain logic.

## Consequences

More up-front contracts, substantially less future lock-in and safer regional expansion. Missing capabilities are explicit rather than hidden fallbacks.
