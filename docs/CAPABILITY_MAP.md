# Capability map

Status values: `implemented`, `partial`, `documented_only`, `missing`, `blocked`.

| Capability | Current | Target | Priority | MCP exposure | Key dependency |
|---|---|---|---|---|---|
| Workspace/auth | partial | tested tenant-safe application context | P0 | implicit auth context | RLS audit |
| ICP/intake | partial | versioned OfferProfile + ICPDefinition | P1 | tool/resource later | domain contracts |
| Market profile | documented_only | capability-driven region/language policy | P0 | resource later | provider registry |
| Public intent | partial | adapter-based expressed-intent sources | P1 | search capability | jobs/evidence |
| Local discovery | documented_only | one legal geography/category slice | P5 | later | market/legal/provider proof |
| Website/company intelligence | partial via Glook | owned/signed snapshot + evidence | P1/P5 | research capability | Glook contract |
| Evidence/provenance | missing | immutable evidence graph | P0 | read-only resource | schema + artifact storage |
| Entity resolution | partial | scored company/person identity | P1/P2 | capability | evidence/providers |
| Opportunity analysis | missing | multidimensional QUALIFY/REVIEW/REJECT | P1 | capability/resource | eval set |
| Buyer resolution | partial | problem/company/market-aware candidates | P1/P2 | capability | people data |
| Contact discovery | partial | provider abstraction | P1 | capability | provider registry |
| Contact verification | partial | separate deliverability semantics | P1 | capability | provider contracts |
| Grounded outreach | partial | claim→evidence draft + human review | P1 | capability | evidence |
| Outcome feedback | missing | review and funnel outcomes | P1/P2 | mutation capability | UI + schema |
| Durable jobs | missing | leases, checkpoints, retry, cancellation | P0 | job resource | DB migration |
| Cost controls | missing | per-run/workspace/source ledgers and caps | P0/P1 | max-cost input | provider runs |
| Observability | partial logs | traces, SLOs, integration health | P0/P1 | admin only | job/provider events |
| AI evaluation | missing | frozen benchmark and regression gate | P1/P2 | none | labeled fixtures |
| AI Visibility | documented_only | bounded observation→finding→action module | P4 | after stability | provider/legal proof |
| Glook bridge | partial/unsafe | versioned owned snapshot contract | P0/P1 | internal capability | Glook changes |
| MCP server | missing | adapter over stable application capabilities | P7 | target itself | auth/jobs/schemas |
| MCP client | missing | optional provider adapter family | P8 | n/a | connector value proof |
| Billing/credits | partial | idempotent verified-package charging; commercial policy separately validated | P0/P3 | not directly exposed | ownership + concurrency |

## Expansion rule

A capability moves from experiment to supported only when it has: legal access classification, contract tests, health state, cost envelope, observability, fallback/disable behavior, quality sample and an owner. Source count is never a milestone by itself.
