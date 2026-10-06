# Data governance

## Data classes

1. Workspace configuration: OfferProfile, ICPDefinition, budgets and policies.
2. Public-source material: source URLs, captured excerpts, structured facts and timestamps.
3. Derived intelligence: company resolution, assessments, confidence and review decisions.
4. Operational metadata: jobs, attempts, provider runs, cost events and audit records.
5. Large artifacts: screenshots/documents stored by hash and signed reference when needed.

The current roadmap does not require personal-contact or mailbox data.

## Rules

- Store the minimum material needed to audit a claim.
- Separate raw observations from model interpretation.
- Record source, capture time, content hash, schema version and verification method.
- Do not log secrets, full raw provider payloads or unnecessary personal data.
- Enforce workspace ownership through RLS and authenticated application context.
- Apply retention/deletion policy by data class and source obligations.
- Deletion must cover relational rows, artifact references, jobs and evaluation copies.
- Provider terms and access status are recorded before live use.

Recorded fixtures must be sanitized, provenance-preserving and authorized for development use.
