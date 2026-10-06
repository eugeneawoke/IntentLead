# Observability, SLOs and cost controls

## Correlation model

Every log/event may include workspace, discovery brief, job, step attempt, opportunity, provider run and trace ids. Personal data and secrets are omitted or irreversibly redacted.

## Required records

- job and step status, lease, heartbeat, attempt and failure class;
- provider/model/version, latency, token/API usage, fallback and cost;
- source funnel counts and rejection reasons;
- evidence creation and assessment version;
- state transitions and review decision;
- authorization and policy denials;
- integration health state.

## Initial SLOs

- accepted dispatch creates a durable job before response;
- no stale `RUNNING` job beyond lease recovery window without alert;
- zero unexpected personal/contact/message records;
- zero cross-tenant reads in automated negative tests;
- provider health and rate-limit state visible;
- cost per accepted Opportunity reported by source and market;
- time from source observation to review-ready Opportunity reported.

Numeric latency/availability targets are set after baseline measurement, not invented now.

## Budget policy

Each job has max total cost; each capability and provider has per-call/attempt caps. Workflow proceeds cheap-to-expensive and stops on rejection. Budget exhaustion returns a structured partial/deferred result and never silently exceeds the cap.

## Alerts

Alert on stale jobs, repeated provider auth/rate failures, cost anomaly, cross-tenant denial anomalies, evidence persistence failure and production evaluation regression.
