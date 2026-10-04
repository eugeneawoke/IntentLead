# AI evaluation strategy

## Goal

Optimize precision and user acceptance, not the volume of scraped signals. Missing a marginal Opportunity is preferable to delivering confident nonsense.

## Frozen benchmark classes

- clear expressed intent;
- weak pain without commercial actionability;
- theoretical/student discussion;
- wrong person or company;
- stale signal;
- already solved problem;
- switching complaint;
- hiring/organizational trigger;
- verifiable website problem;
- local listing/review problem;
- AI visibility finding with repeated evidence;
- adversarial prompt injection and poisoned evidence.

Each fixture stores expected decision range, mandatory evidence, prohibited claims, acceptable buyer roles and rationale. Real personal data is minimized or sanitized.

## Metrics

- precision of ACCEPT;
- false-positive rate;
- human-review agreement;
- company-resolution accuracy;
- buyer-resolution top-k accuracy;
- evidence coverage and unsupported-claim rate;
- stability across repeated model runs;
- stale-signal and wrong-company rates;
- cost and latency per accepted Opportunity.

## Gates

- Unsupported factual claims in outreach: zero tolerance.
- Every model upgrade or prompt change runs the same benchmark.
- A change cannot trade a material precision loss for more candidates without product approval.
- Evaluations report by signal family, source, market and model; aggregate averages cannot hide a bad cohort.

## Human labels

Reviewers choose accepted, rejected or needs research and a reason: wrong company, wrong person, weak signal, not relevant, too old, already solved, invalid contact, duplicate, policy concern or other with note. Outreach outcomes are recorded separately from assessment labels.

## Production calibration

Compare benchmark quality to real acceptance, positive replies, meetings and cost. Never auto-train or modify production prompts from feedback without reviewed datasets, versioned change and rollback.
