# Pilot validation protocol

Status: proposed template. Complete and freeze one copy before every live pilot or source/domain expansion.

## Decision header

```text
Experiment id:
Owner:
Decision date:
Market/jurisdiction:
Offer:
Audience hypothesis (not assumed fact):
Signal family and detector:
Source/provider:
Start/end date:
Maximum provider spend:
Allowed outreach action:
```

## Unit and sample

- Sampling unit: define whether one unit is a source item, company, Opportunity, accepted Opportunity or contacted Opportunity.
- Inclusion/exclusion rules: freeze before collection.
- Duplicate rule: define company/source/time-window deduplication.
- Minimum sample size: declare for each decision; `3–5 design partners` is qualitative discovery, not proof of repeatability.
- Review protocol: number of reviewers, blind/double review if needed, and disagreement resolution.
- Baseline/control: define unsignaled prospecting, previous detector/version or holdout where feasible.

## Metric definitions

```text
delivered = reviewable Opportunity with required evidence and limitations
accepted = reviewer judges it worth action under the declared offer/ICP
contacted = approved outreach was actually sent through the allowed channel
qualified_positive_conversation = reply from a relevant person that confirms a relevant problem or agrees to a substantive next step
```

Report at minimum:

- accepted / delivered;
- contacted / accepted;
- qualified positive conversations / contacted;
- qualified positive conversations / delivered;
- wrong-company, wrong-person, stale/already-solved, insufficient-evidence, invalid-contact and policy-rejection rates;
- cost and latency per delivered and accepted Opportunity;
- complaints, opt-outs and source/provider failures.

## Predeclared decision thresholds

Do not put universal numbers in the platform docs. For each experiment, the owner records:

- minimum acceptance rate and confidence interval/reporting rule;
- maximum wrong-company, unsupported-claim and invalid-contact rates;
- maximum cost per accepted Opportunity;
- minimum qualified-conversation result or qualitative learning criterion;
- stop condition for legal, provider, abuse or complaint risk;
- GO, REWORK and STOP rules.

## Evidence packet

Store the frozen brief, sampled ids, sanitized labels, detector/model/provider versions, costs, failures, metric calculations, reviewer notes, deviations and final decision. Do not retain more personal or source content than the data policy allows.

## Interpretation rule

A positive small concierge pilot shows that a workflow and problem may be valuable; it does not establish a universal persona, scalable source economics or market superiority. Expansion requires a separately preregistered test.
