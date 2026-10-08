# Data governance

## Data classes

1. Workspace configuration: OfferProfile, ICPDefinition, budgets and policies.
2. Public-source material: source URLs, captured excerpts, structured facts and timestamps.
3. Derived intelligence: company resolution, assessments, confidence and review decisions.
4. Business-contact research: buyer candidates, public/authorized business contact points, verification observations and source evidence.
5. Grounded content: conversation briefs, drafts and claim-to-evidence links.
6. Operational metadata: jobs, attempts, provider runs, cost events and audit records.
7. Large artifacts: screenshots/documents stored by hash and signed reference when needed.

Mailbox credentials, message transmission and delivery events are not collected. Contact research is a product capability and must remain minimal, source-bound and removable.

## Rules

- Store the minimum material needed to audit a claim.
- Separate raw observations from model interpretation.
- Record source, capture time, content hash, schema version and verification method.
- Do not log secrets, full raw provider payloads or unnecessary personal data.
- Enforce workspace ownership through RLS and authenticated application context.
- Apply retention/deletion policy by data class and source obligations.
- Store contact discovery separately from verification; “found” is never silently treated as verified.
- Record contact source URL, capture time, company/role relation, market policy, confidence and value hash.
- Do not guess personal emails or retain unrelated personal profile data.
- Apply suppression/opt-out policy to copy/export eligibility even though IntentLead does not send.
- Every material draft claim references evidence; drafts cannot become an ungrounded data copy.
- Deletion must cover relational rows, artifact references, jobs and evaluation copies.
- Provider terms and access status are recorded before live use.

Recorded fixtures must be sanitized, provenance-preserving and authorized for development use.
