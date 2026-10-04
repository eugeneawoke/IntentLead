# Documentation cleanup and authority map

Status date: 2026-10-04.

Founder acceptance recorded 2026-10-04: PRODUCT, ROADMAP-V2 and ADR-001–008 are accepted; the authority order below is active. Root historical banners and agent pointers are being reconciled in Task 0.

No historical document is deleted by this plan. The immediate goal is to stop agents from treating outdated phase labels and current-state claims as authoritative while preserving useful rationale.

## Authority order

1. Executable code and migrations define current behavior.
2. `docs/CURRENT_STATE_AUDIT.md` records the dated verified baseline.
3. Accepted `docs/PRODUCT.md`, `DOMAIN_MODEL.md`, `ARCHITECTURE.md` and ADR-001–008 define target direction.
4. Accepted `docs/ROADMAP-V2.md` defines phase order; `docs/IMPLEMENTATION_PLAN.md` is the immediate task plan and `IMPLEMENTATION_BACKLOG.md` is the broader backlog.
5. Root product documents and older plans remain historical context.

## File disposition

| Existing document | Useful content | Problem | Action |
|---|---|---|---|
| `SPEC.md` | Original MVP invariants and user flow | Describes pre-build state and Lead-centric model | Keep historical; migrate durable invariants through ADRs |
| `PLAN.md` | Original phase sequence | Completed work still appears future; phase model no longer fits | Stop executing; replace with ROADMAP-V2 |
| `TODO.md` | Earlier blockers and tasks | Mixes completed, stale and current work | Preserve; create new work from IMPLEMENTATION_BACKLOG |
| `MEMORY.md` | Decisions and Glook lessons | Contains dated implementation assumptions | Preserve as decision history; verify before reuse |
| `DECISIONS.md` | Earlier architecture decisions | Some remain valid but do not cover Opportunity core | Preserve and reference new ADR directory |
| `EVIDENCE.md` | Evidence discipline and provider notes | Needs dated current verification | Preserve; record new measurements with reproduction details |
| `MASTER_BUILD_PROMPT.md` | Original autonomous build framing | Assumes code has not been built | Retire as executable prompt |
| `PROJECT_IDEA.md` | Product history | Too broad and partly superseded | Keep as ideation archive |
| `intentlead_mvp_scope.md` | MVP scope thinking | Not authoritative for current build | Keep historical |
| `AI_MODELS_AUDIT.md` | Model-selection context | Model availability/cost may drift | Reverify before decisions |
| `DESIGN_SYSTEM.md` | Current visual language | May still be active | Keep authoritative for UI until separately revised |

## Cleanup sequence

1. Add a short superseded banner to historical executable plans only after the founder accepts this documentation set.
2. Update `AGENTS.md` and `CLAUDE.md` references to point to `docs/INDEX.md` in a separate approved change.
3. Merge still-valid invariants into the canonical docs or ADRs; do not duplicate entire sections.
4. Move obsolete execution plans into an archive directory only with explicit approval.
5. Add a lightweight documentation check that validates internal links and required status dates.

## Drift-control rule

Every document that describes current external state must contain a date. Every document that describes target design must say whether it is accepted, proposed or experimental. Agents must report a contradiction instead of silently choosing the most convenient file.
