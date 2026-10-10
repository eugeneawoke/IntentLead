# Task K Free-Source Portfolio Eval v1

## Capability under evaluation

The `EN_DISCOVERY_ONLY` source layer can add GitHub and Stack Exchange to the existing Reddit and Hacker News portfolio without weakening the shared provider contract, evidence provenance, budget gates, or no-send boundary.

This eval is fixture-only. It neither authorizes nor performs live provider calls.

## Required scenarios

1. GitHub issue search normalizes stable source id, canonical public URL, content, context, and publication time.
2. Stack Exchange advanced search normalizes the same vendor-neutral signal shape.
3. Every returned signal has a one-to-one provenance row containing the provider, provider source id, run id, capture time, and exact public source URL.
4. Duplicate records from overlapping keywords or pages are removed deterministically by provider source id.
5. Pagination is bounded by the provider runtime record limit and never follows an unbounded `has_more`/next-page chain.
6. GitHub 403/429 rate-limit responses and Stack Exchange `backoff` responses produce an explicit rate-limited or partial outcome without retry storms.
7. Malformed, oversized, timed-out, and cancelled responses fail through the existing provider error contract without persisting response bodies or secrets.
8. The source catalog states that an adapter is implemented while live execution remains disabled until an explicit activation gate.
9. Source planning distinguishes executable sources from planned, credential-gated, paid-locked, restricted, or legally unassessed sources.
10. Funnel terminology remains separate: fetched, normalized, deduplicated, confirmed, unique-company, and opportunity counts are never treated as synonyms.

## Regression scenarios

1. Existing Reddit and Hacker News fixture behavior and schemas remain valid.
2. Provider selection still rejects paid, prohibited, unassessed, disabled, or unreserved execution.
3. Fixture tests cannot reach the global network and require injected HTTP clients.
4. No contact lookup, message delivery, billing, production deployment, or production migration path becomes reachable.
5. The normalized signal contract contains no provider-specific fields.
6. A source being present in the catalog does not imply that it is live-enabled.

## Deterministic graders

- Contract grader: TypeScript compile and strict Zod parsing pass for all fixtures.
- Provenance grader: returned signal ids and provenance source ids form a bijection; URLs match exactly.
- Bound grader: request and record counts never exceed configured limits.
- Failure grader: each failure fixture maps to the expected status/failure kind and records one terminal provider run.
- Catalog grader: implemented-but-disabled sources are not selected as executable.
- Regression grader: focused provider, source-plan, and workflow tests remain green.

## Thresholds

- Critical invariants (provenance, bounded execution, no unauthorized live/paid/send path): `pass^3 = 1.00` across three deterministic repeats.
- Capability scenarios: at least 90% pass before Task K can be marked complete; no critical invariant may fail.
- The product target of at least 20 confirmed signals is measured across the combined portfolio during the later end-to-end pilot gate (Task M), not inferred from raw provider response counts in Task K.

## Non-goals

- Proving live quota availability or provider uptime.
- Enabling production credentials or paid tiers.
- Treating API records as confirmed commercial opportunities.
- Implementing every catalog entry in one batch.

## Recorded result

On 2026-10-10, the 107-test focused domain/provider/workflow suite passed three deterministic repeats (`107/107` each; `pass^3 = 1.00`). The repository gate also passed both typechecks, lint with zero errors and nine pre-existing UI warnings, all `587/587` unit tests, and the production build. No live network, paid provider, production migration or sending path was used.

Reproduction command (run the same command three times):

```bash
npm run test:unit -- --run tests/domain/source-plan.test.ts tests/domain/discovery-funnel.test.ts tests/domain/market-profile-foundations.test.ts tests/providers/free-source-adapters.test.ts tests/providers/free-source-failures.test.ts tests/providers/free-source-provenance.test.ts tests/providers/source-portfolio.test.ts tests/providers/official-site-contact.test.ts tests/providers/registry-execution.test.ts tests/workflows/fixture-runtime.test.ts tests/workflows/fixture-network-authority.test.ts tests/workflows/self-prospecting.test.ts
```
