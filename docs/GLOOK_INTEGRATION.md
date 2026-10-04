# Glook integration contract

## Current problem

The repositories are expected to share Supabase; the deployed project identity still needs confirmation. IntentLead reads Glook `scans` and internal JSON using service role. The 2026-10-04 local Task 2 change requires `scanId` plus the authenticated `userId` in `getOwnedGlookContext`, and both report and chat paths filter by owner and `status = 'done'`. Missing, foreign and unfinished scans all return the same 404 before warm context reaches embeddings or the model. Negative route tests pass; this has not been deployed. Direct schema coupling remains debt. Glook AI readiness is also not evidence of observed AI visibility or buying intent.

## Target boundary

```text
Glook
→ authenticated versioned API or signed event
→ immutable redacted SiteContextSnapshot
→ IntentLead SourceItem + EvidenceItems
```

Minimum snapshot fields:

```text
schemaVersion
snapshotId
scanId
subjectUserId / tenant binding
siteUrl
capturedAt
businessContext
findings[] with explicit domain semantics
source/provenance
redaction policy
signature / issuer
```

## Rules

- Caller identity must own or be explicitly authorized for the source scan.
- IntentLead never relies on unversioned `scans.results` shape.
- Glook findings remain readiness/site findings unless observed evidence supports stronger semantics.
- Imported content is untrusted and passes validation/sanitization.
- Snapshot import is idempotent and auditable.
- Direct cross-product writes are forbidden.
- Shared auth/billing may remain infrastructure, but product tables have clear ownership and migration namespaces.

## Migration

1. Close ownership gap in every existing warm path.
2. Define snapshot schema and contract tests in both repositories.
3. Add Glook export endpoint or signed event.
4. Import into IntentLead source/evidence tables.
5. Shadow-compare direct DB and contract output.
6. Remove direct table reads after parity and rollback window.

The owner-bound direct read in step 1 is temporary debt. It may support a bounded warm-path smoke test but must be removed before AI Visibility work, public MCP exposure or a production Glook-dependent pilot. The removal evidence is zero runtime call sites that read Glook internal tables directly.

## Reuse decisions

Potential reuse: safe fetch/crawl, robots/structured-data diagnostics, scheduled scanning and evidence primitives after code/contract review. Do not reuse the Glook monolithic scan aggregate, global score or AI-readiness claims as Opportunity truth.
