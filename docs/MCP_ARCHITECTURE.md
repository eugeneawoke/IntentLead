# MCP architecture

## Assessment

MCP-ready today: **no; partial foundations only**. TypeScript, HTTP endpoints, Supabase auth/RLS and a worker exist, but business logic is bound to route/worker modules. Stable application capabilities, workspace-scoped tool authorization, durable jobs, idempotency, pagination, structured errors, provenance, cost scopes and audit logs are missing.

## Target

```text
providers → normalization/evidence → domain services
→ application capabilities → job orchestration
→ Web API | UI | internal agents | MCP adapter
```

MCP is a transport adapter, never a second implementation and never a vendor façade.

## Candidate tools

| Capability | Mode | Permission | Cost |
|---|---|---|---|
| `start_opportunity_search` | async mutation | opportunity:write | bounded/high |
| `get_job` | read | job:read | none |
| `list_opportunities` | paginated read | opportunity:read | none |
| `get_opportunity` | read | opportunity:read | none |
| `research_company` | async | company:research | bounded |
| `find_buyer` | sync/async | buyer:resolve | bounded |
| `verify_contact` | async mutation | contact:verify | metered |
| `draft_outreach` | sync/async | outreach:draft | bounded |
| `record_review` | idempotent mutation | opportunity:review | none |
| `record_outcome` | idempotent mutation | outcome:write | none |

Names remain provisional until application services exist. Vendor-specific tools are admin/debug only, if ever.

## Tool contract

Every tool declares input/output JSON Schema, schema version, permission scopes, sync/async mode, cost class, rate limit and error taxonomy. Mutations accept idempotency key; costly calls accept optional `max_cost`. Responses include trace id, evidence references, confidence/limitations and never trust an input workspace id as authority.

Long operations return:

```json
{"job_id":"uuid","status":"queued","poll_after_seconds":2,"trace_id":"uuid"}
```

## Resources

Expose read-only, tenant-authorized resources for Opportunity, Evidence, Company and Job with cursor pagination and redacted views. Large/raw evidence uses signed, short-lived access where policy permits.

## Prompts

Reusable prompts may later help external agents research an account or prepare evidence-backed outreach. Core intelligence must not depend on MCP prompt templates.

## Authentication and authorization

API token or OAuth identity maps server-side to user, workspace membership and capability scopes. Cost and data policy are checked inside application services. MCP consumers cannot select arbitrary workspace authority or bypass suppression/human-review rules.

## Release stages

1. Phase 0: transport-neutral schemas/services/jobs.
2. Internal adapter test against fake client.
3. Private read-only resources and job status.
4. Scoped mutation tools for approved workspaces.
5. Public documentation/examples after abuse, cost and audit gates.

## MCP client role

Future external CRM/search/CMS integrations may use `MCPProviderAdapter` where it adds clear value. Native integrations remain preferred for reliability, cost, data rights and observability when superior.
