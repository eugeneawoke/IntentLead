# ADR-002: Glook is an optional versioned context adapter

**Status:** Accepted integration boundary; activation deferred.

## Context

Legacy code reads Glook internal tables through service role. This creates ownership and schema coupling. Glook's technical findings are not required for IntentLead's business-wide Opportunity workflow.

## Decision

Remove direct table reads. If a measured use case later justifies Glook, consume only an authenticated, owner-authorized, versioned snapshot through an API or signed event.

The snapshot may help understand a business or contribute an observation. It cannot trigger a technical audit inside IntentLead, qualify an Opportunity by itself or become a first-pilot dependency.

## Consequences

The existing consumer adapter remains dormant. Producer work is postponed. Direct-read removal is security debt, not a product-integration milestone.
