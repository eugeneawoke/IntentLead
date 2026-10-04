# ADR-001: Opportunity is the core aggregate

**Status:** Accepted by founder, 2026-10-04; no amendments.

## Context

The current pipeline equates a public post plus enriched contact with a lead. New scenarios include detected website, local, review and AI visibility problems that are not expressed buying intent.

## Decision

Adopt Opportunity as the central commercial aggregate. Signal, Evidence, Company, Buyer and Contact have separate lifecycle and confidence. Leads remain a temporary delivery projection.

## Consequences

The data model and UI become more explicit; current code requires a strangler migration. The product can add intelligence domains without semantic dishonesty.
