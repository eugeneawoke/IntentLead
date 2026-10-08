# Observability, SLOs and cost controls

## Correlation model

Every log/event may include workspace, discovery brief, job, step attempt, opportunity, provider run and trace ids. Personal data and secrets are omitted or irreversibly redacted.

## Required records

- job and step status, lease, heartbeat, attempt and failure class;
- provider/model/version, latency, token/API usage, fallback and cost;
- source funnel counts and rejection reasons;
- evidence creation and assessment version;
- state transitions, buyer/contact verification, draft grounding and review decision;
- authorization and policy denials;
- integration health state.

## Initial SLOs

- accepted dispatch creates a durable job before response;
- no stale `RUNNING` job beyond lease recovery window without alert;
- zero unsupported or unproven contact records;
- zero message-transmission, mailbox, sequence or delivery records;
- zero cross-tenant reads in automated negative tests;
- provider health and rate-limit state visible;
- raw → confirmed signal → unique company → Opportunity → verified contact → grounded draft funnel visible;
- requested target, achieved count and `PARTIAL` shortfall visible;
- contact coverage/verification and draft claim-grounding coverage reported;
- cost per accepted package reported by source and market;
- time from source observation to contact-ready Opportunity reported.

Numeric latency/availability targets are set after baseline measurement, not invented now.

## Budget policy

Each job has max total cost; each capability and provider has per-call/attempt caps. Workflow proceeds cheap-to-expensive and stops on rejection. Free-tier consumption is measured as a finite quota, not assumed to be unlimited or permanent. Budget exhaustion returns a structured partial/deferred result and never silently exceeds the cap.

## Alerts

Alert on stale jobs, repeated provider auth/rate failures, cost anomaly, cross-tenant denial anomalies, evidence persistence failure and production evaluation regression.
