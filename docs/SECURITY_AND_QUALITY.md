# Security and quality overview

IntentLead handles external content, tenant-owned workflow data and model/provider output. The implementation treats all three as explicit trust boundaries.

## Security posture represented in the repository

- Tenant-owned records are protected by application authorization and Postgres row-level security.
- Service-role credentials stay on server and worker paths and are never intended for browser use.
- Provider and model output is validated before it reaches domain or persistence logic.
- Fixed system instructions remain separate from untrusted user and source content.
- External URLs are validated before being exposed through review surfaces.
- Privileged operations use strict validation, bounded requests and rate limiting.
- Durable jobs use ownership, lease and replay controls rather than trusting a caller-supplied state transition.
- Logs are designed to avoid secrets, personal data and raw provider payloads.

## Evidence and model safety

The system separates source observations from interpretation. Material generated claims must refer back to evidence, and missing support is handled as a failure or limitation. A model cannot authorize providers, raise budgets, create external actions or turn its own output into evidence.

## Verification layers

The codebase includes:

- unit tests for domain rules and application behavior;
- contract tests for typed boundaries;
- database integration tests for migrations, RLS and concurrency-sensitive operations;
- worker tests for retries, cancellation and replay behavior;
- browser tests for critical review journeys;
- production builds and strict TypeScript checks as release gates.

Some integration suites require local infrastructure and are not implied to run from a plain clone without configuration.

## Deliberate boundary

IntentLead does not contain mailbox connection, automatic sending, sequences, follow-ups or delivery tracking. Any future external provider activation requires explicit configuration and validation; disabled or fixture-backed adapters are not presented as live integrations.
