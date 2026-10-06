# Opportunity Core smoke checklist

## Discovery brief

- [ ] Authenticated user creates or selects an OfferProfile and ICPDefinition.
- [ ] DiscoveryBrief shows market, exclusions, evidence policy and zero-cost budget.
- [ ] Foreign workspace ids are denied without enumeration.

## Durable run

- [ ] Start returns HTTP 202 only after the job exists.
- [ ] Worker uses fixture/no-network providers and records zero cost.
- [ ] Progress survives retry/restart and never creates duplicate evidence or Opportunity.
- [ ] Cancel reaches a deterministic terminal state.

## Opportunity review

- [ ] Opportunity shows company, observed condition, commercial interpretation and limitations.
- [ ] Every material claim links to accessible evidence and provenance.
- [ ] Model assessment and human review state are visually distinct.
- [ ] Accept, reject and needs-research require the appropriate review metadata.
- [ ] Foreign Opportunity/evidence access is denied.

## Negative product boundary

- [ ] No contact, email, message, mailbox, send, sequence or delivery control exists.
- [ ] Legacy lead/export/message routes are absent or explicitly retired.
- [ ] No direct Glook table read occurs.
- [ ] Website content, if present, is labeled business context rather than an automatic audit.

## Deletion

- [ ] Owner deletion cancels active jobs and removes/redacts all owned workflow data.
- [ ] No orphaned evidence, artifact metadata or evaluation copy remains outside documented retention.
