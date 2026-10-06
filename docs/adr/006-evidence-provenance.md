# ADR-006: Evidence provenance is mandatory

**Status:** Accepted.

## Context

Opportunity value depends on whether a human can inspect why a company was selected. Provider payloads and model interpretations are fallible and mutable.

## Decision

Every material Opportunity claim references immutable evidence with source, capture time, content hash, verification method, schema version and provenance. Raw observations and interpretation are stored separately. Unsupported facts are rejected or explicitly labeled as inference.

## Consequences

Evidence storage, access control, retention and deletion are product-critical. Model fluency never substitutes for verification.
