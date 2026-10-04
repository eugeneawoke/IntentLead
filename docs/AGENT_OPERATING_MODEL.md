# Agent operating model

## Principle

Agents implement bounded work under deterministic gates. They do not negotiate architecture among themselves indefinitely, mutate shared state without ownership, or mark work complete from narrative confidence.

## Roles

| Role | Owns | Must not do |
|---|---|---|
| Root orchestrator | milestone, interfaces, ownership, merge/gates, user escalation | implement overlapping areas concurrently |
| Explorer | read-only code/current-state mapping | edit or decide architecture |
| Docs researcher | official provider/framework/legal evidence | treat vendor claims as verified outcomes |
| Architect/domain planner | boundaries, contracts, ADRs, migration path | ship code without approved spec |
| Data implementer | migrations, RLS, RPC, repositories | edit UI/provider code |
| Workflow/provider implementer | jobs, orchestration, adapters | bypass domain contracts |
| Frontend implementer | Opportunity review/progress/error surfaces | invent backend state |
| AI/eval implementer | typed prompts, fixtures, metrics | control charging or terminal states |
| Reviewer | fresh-context correctness and maintainability review | approve own implementation |
| Security/DB reviewer | tenancy, authz, RLS, migrations, abuse cases | auto-fix without returning findings |
| E2E/a11y verifier | critical user journeys and accessibility | replace backend integration tests |

## Task packet

Every delegated task includes:

- objective and non-goals;
- exact files/ownership boundary;
- consumed/produced interfaces;
- invariants and threat cases;
- required tests and commands;
- cost/time budget;
- completion evidence;
- stop/escalation conditions.

## Work isolation

- Use a managed git worktree for implementation milestones when suitable. The current Opportunity Core milestone uses the approved `codex/opportunity-core` branch in the existing checkout because accepted canonical docs are untracked working-tree inputs; see `.superpowers/sdd/IMPLEMENTATION_PLAN/progress.md`.
- One writer owns a file set at a time.
- Read-only reviewers may inspect concurrently.
- Database and shared contract changes land before dependent work.
- No agent uses `git add -A`; protected project documents and secrets are never committed under existing repository policy.

## Quality flow

```text
approved spec
→ failing test or measurable baseline
→ minimal implementation
→ focused verification
→ independent review
→ full affected-suite verification
→ release evidence
→ memory/docs update
```

## ECC use

ECC 2.2.3 is installed as one native Codex plugin. Use its gated engineering practices selectively. Do not add legacy Codex sync or a second ECC install. Relevant capabilities are planning, TDD, type/database/security review, silent-failure review, E2E, evaluation and bounded autonomous loops. Do not load unrelated language/mobile/ML agents or continuous-learning systems that duplicate project memory.

## Agent count

Use the smallest useful team. The default implementation milestone has one orchestrator, up to three non-overlapping implementers, then fresh reviewers. LLM reasoning inside the product is not modeled as a chatty swarm; it is typed reasoning steps called by the workflow.
