# ADR-001: Opportunity is the core aggregate

**Status:** Accepted; revised 2026-10-06.

## Context

The original product equated a discovered public signal plus enrichment with a lead. The accepted product must reason across expressed intent, business events, market context and observable commercial conditions while preserving evidence and uncertainty.

## Decision

Adopt Opportunity as the only target commercial aggregate. SourceItem, EvidenceItem, Company, Signal, OpportunityAssessment and ReviewDecision have distinct lifecycle and confidence.

Lead, verified-contact packages, messages and send outcomes are legacy implementation concepts, not future domain projections. They will be removed after native DiscoveryBrief authority replaces their remaining database dependencies.

## Consequences

Provider and model outputs require normalization and provenance. Reject and needs-research are normal outcomes. Product quality is measured by evidence-backed human acceptance, not contact volume.
