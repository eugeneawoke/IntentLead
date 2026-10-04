# ADR-007: Charging attaches to an idempotent verified package

**Status:** Accepted by founder, 2026-10-04; no amendments. `PACKAGE_VERIFIED` remains the atomic, owner-validated, idempotent credit trigger. Future commercial payment policy requires a separate decision.

## Decision

No charge occurs for machine-rejected, insufficient-evidence, failed or duplicate work. A `PACKAGE_VERIFIED` event requires the explicit verification policy; the database validates ownership and exactly-once package identity atomically. Human acceptance/rejection is a separate feedback event and is not silently substituted as the billing trigger. Provider costs are tracked separately from customer credits.

`VerificationPolicy` is versioned and records required evidence sufficiency, company resolution, buyer hypothesis, contact verification, grounded draft, suppression eligibility and market/workflow overrides. The package stores the policy version and deterministic check results used to emit `PACKAGE_VERIFIED`.

## Consequences

The existing verified-only rule remains until a separately accepted product decision changes it. The old four-boolean RPC must evolve to an owner-validating idempotent package rule. Real concurrency tests and product policy are required before paid pilot.
