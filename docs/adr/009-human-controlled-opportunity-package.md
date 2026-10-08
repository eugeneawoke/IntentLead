# ADR-009: Contact-ready Opportunity packages remain human-controlled

**Status:** Accepted, 2026-10-06.

## Context

The source product model requires a usable path from observable commercial evidence to a relevant buyer, verified contact and grounded conversation angle. An accidental reset treated contact lookup and drafting as equivalent to automated outreach and removed both. That made the product materially less useful and contradicted the approved first vertical slice.

At the same time, IntentLead must not become a spam bot, mailbox product or autonomous AI SDR.

## Decision

An Opportunity package may contain:

- ranked buyer candidates;
- a public or authorized business contact;
- independent contact verification and provenance;
- an evidence-grounded conversation brief;
- a copyable draft whose material claims reference EvidenceItems.

Opportunity remains the core aggregate. Contact and draft records are subordinate, workspace-scoped and removable.

IntentLead does not send or schedule messages, connect mailboxes, run sequences or follow-ups, or track delivery. Copy/export is a human-controlled boundary. Human-reported outcomes may be recorded as feedback but cannot trigger external action.

`EN_DISCOVERY_ONLY` permits research through contact verification and grounded drafting while denying all transmission capabilities. Paid providers and production changes remain separately gated.

## Consequences

- Buyer/contact/draft contracts and storage return through a new forward-only migration; deleted legacy lead/message/credit tables are not restored.
- Every delivered contact requires source, capture time, verification state, market policy and confidence.
- Every material draft claim requires evidence linkage; unsupported claims fail closed.
- Source selection and contact enrichment are budget-aware and proceed from cheap/free deterministic sources to explicit fallbacks.
- UI exposes copy/export and human review, never a send button.
