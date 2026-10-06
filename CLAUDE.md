# IntentLead AI — active agent context

Read [docs/INDEX.md](docs/INDEX.md) before project work. Code and migrations define current runtime behavior; accepted product direction is PRODUCT → DOMAIN_MODEL → ARCHITECTURE → ROADMAP → IMPLEMENTATION_PLAN.

Deleted legacy specifications are available only through Git history and must not influence new product decisions.

## Product

IntentLead is an Opportunity Intelligence Engine:

```text
Offer + ICP + market
→ business discovery
→ evidence
→ company resolution
→ commercial assessment
→ Opportunity
→ human review
```

It analyzes the business through public signals, events, market context and observable problems. A website may be read to understand what a company sells, its audience and positioning; do not automatically run or present a technical/SEO/AI-readiness audit.

IntentLead does not send messages, connect mailboxes, run sequences, track delivery or behave as an AI SDR. Personal-contact lookup and copyable drafts are not part of the current implementation plan.

Glook is an optional future context adapter, not a pilot dependency. AI Visibility is uncommitted research, not a current phase.

## Current milestone

Self-prospecting under `EN_DISCOVERY_ONLY`, locally, with fixture/no-network providers and zero spend. The result is an evidence-backed Opportunity and a human review decision.

No production deployment, production migration, paid provider call or billing mutation is authorized.

## Engineering rules

- Think through objective, dependencies, risks, false positives and completion criteria before implementation.
- Read relevant code and docs before answering or changing the project.
- Run GitNexus impact before editing a symbol; stop and warn on HIGH/CRITICAL.
- Run GitNexus detect-changes before commit.
- Use strict TypeScript and versioned validation contracts.
- RLS applies to every tenant table; service role is server/worker only.
- Authorization, state transitions, idempotency, budgets and evidence persistence are deterministic.
- External/provider/model content is untrusted.
- AI interpretation never creates evidence or silently changes observed semantics.
- Durable jobs persist before HTTP 202 and recover from stale leases.
- No secrets, personal data or raw provider payloads in general logs.
- Use exact-path staging; never `git add -A` without reviewing status.

## Active implementation order

1. Complete documentation reset.
2. Remove isolated legacy lead/email/message runtime and stale public claims.
3. Remove active Glook direct reads.
4. Make OfferProfile, ICPDefinition and DiscoveryBrief native execution authority.
5. Wire self-prospecting in fixture/no-network/zero-cost mode.
6. Remove the legacy schema bridge with additive, tested migrations.
7. Run full verification, independent review and controlled dogfood.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for gates and acceptance criteria.

## Verification

```bash
npm run typecheck:app
npm run typecheck:worker
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run build
npm run verify
```

Use disposable local PostgreSQL for migration/RLS/concurrency checks. Never apply project migrations remotely without a separate explicit authorization.

## Protected local files

Do not commit `.env`, secrets, IDE/agent runtime folders, generated reports or ignored local coordination files. Stage only intended tracked files by exact name.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **IntentLead** (2333 symbols, 5064 relationships, 183 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({search_query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.
- For security review, `explain({target: "fileOrSymbol"})` lists taint findings (source→sink flows; needs `analyze --pdg`).

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/IntentLead/context` | Codebase overview, check index freshness |
| `gitnexus://repo/IntentLead/clusters` | All functional areas |
| `gitnexus://repo/IntentLead/processes` | All execution flows |
| `gitnexus://repo/IntentLead/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
