# ADR-001: Opportunity is the core aggregate

**Status:** Accepted; revised 2026-10-06.

## Context

The original product equated a discovered public signal plus enrichment with a lead. The accepted product must reason across expressed intent, business events, market context and observable commercial conditions while preserving evidence and uncertainty.

## Decision

Adopt Opportunity as the only target commercial aggregate. SourceItem, EvidenceItem, Company, Signal, OpportunityAssessment and ReviewDecision have distinct lifecycle and confidence.

Lead remains a legacy storage/delivery label rather than a target aggregate. Buyer candidates, verified contact points and grounded conversation briefs are subordinate parts of an Opportunity package and do not become a competing Lead aggregate. Send and delivery events are not application capabilities.

## Consequences

Provider and model outputs require normalization and provenance. Reject and needs-research are normal outcomes. Product quality is measured by evidence-backed human acceptance, company/buyer/contact accuracy and grounded-package usefulness, not raw contact volume.
