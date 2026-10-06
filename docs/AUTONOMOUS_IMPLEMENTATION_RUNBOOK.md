# Autonomous implementation runbook

## Preconditions

Autonomous execution may start only when the milestone has an approved spec, interfaces, file ownership, tests/evaluation plan, threat model delta, budget and rollback. If any is missing, the agent stops at planning.

## Loop

1. Read `docs/INDEX.md`, milestone spec, ADRs and current status.
2. Confirm a clean isolated worktree and record existing user changes.
3. Refresh GitNexus index; query the flow and run impact for every changed symbol.
4. Run focused baseline commands and save results.
5. Implement one independently reviewable task using test-first steps.
6. Run focused tests, typecheck and relevant integration checks.
7. Run GitNexus `detect_changes` and check expected flows.
8. Assign the task to a fresh reviewer; return findings to the implementer.
9. After approval, checkpoint with a named commit containing only intended files.
10. Repeat until milestone gate, then run full release verification.

## Limits

Default limits per task unless the plan states otherwise:

- maximum three implementation attempts for the same failure;
- maximum two reviewer cycles;
- provider live-call budget set explicitly, default zero;
- no production migrations, deploys, outbound messages or billing mutations without explicit milestone authorization;
- stop on HIGH/CRITICAL GitNexus impact until the user sees the warning;
- stop on contradictory schema/domain requirements;
- stop when required external credentials or legal approval cannot be safely substituted by fixtures.

## Failure policy

- Tests failing from an existing baseline are documented, not silently ignored.
- A repeated failure after the retry limit becomes a blocker report with reproduction, evidence and safest next choice.
- Partial implementation is not marked done.
- An agent cannot weaken a test, security control, invariant or quality threshold solely to turn the suite green.

## Release evidence packet

- commit/diff scope;
- affected GitNexus flows;
- build/typecheck/unit/integration/E2E results;
- migration and RLS evidence;
- AI evaluation delta;
- security findings and disposition;
- provider live-smoke result and cost;
- screenshots for changed critical UI;
- rollback steps;
- known limitations.

## Human checkpoints

Human confirmation is required before: production schema migration, any unapproved provider spend, changing billing semantics, publishing MCP externally, or accepting a legal/compliance trade-off. IntentLead has no sending capability.
