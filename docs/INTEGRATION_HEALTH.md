# Integration health registry

Status date: 2026-10-04. This is the operational truth table for external systems. “Implemented” means code exists; it does not mean credentials, production access or provider quality have been confirmed.

## Current registry

| Integration | Capability | Code state | Credential state | Live verification | Production disposition |
|---|---|---:|---:|---:|---|
| Supabase | Auth, database, RLS, shared Glook project | Implemented | Not confirmed in this audit | Local/static only | Blocked on project/schema confirmation |
| Reddit | Public signal discovery | Implemented | Not confirmed | Not run | Keep behind source adapter |
| Hacker News | Public signal discovery | Implemented | Public API path | Not run | Keep behind source adapter |
| Exa | Company resolution | Implemented | Not confirmed | Not run | Primary resolver candidate |
| Serper | Company resolution fallback | Implemented | Not confirmed | Not run | Fallback only |
| Prospeo | Email discovery/verification | Implemented | Not confirmed | Not run | Capability semantics need audit |
| Hunter | Email discovery/verification | Implemented | Not confirmed | Not run | Capability semantics need audit |
| Apollo | Email discovery/verification | Implemented | Not confirmed | Not run | Capability semantics need audit |
| OpenAI | Classification and generation | Implemented | Not confirmed | Mocked tests only | Add model/prompt/eval registry |
| Railway worker | Pipeline execution | Implemented process | Deployment not confirmed | Not run | Replace HTTP fire-and-forget with durable jobs |
| Vercel | Web deployment | Configuration present | Project/link not confirmed | Build only | Confirm preview and production projects |
| PayPro Global | Billing | Documented target | Product IDs not provided | Not run | Do not enable until webhook and credit tests pass |
| Glook | Warm-context source | Direct shared-table code exists | Schema/ref unconfirmed | Not run | Replace with versioned owned contract |
| Google Maps / Places | Local discovery | Architecture only | Not provided | Not run | Later market-profile experiment |
| Google CSE | Website/search discovery | Documented only | Not provided | Not run | Reassess against detector requirements |
| AI Visibility providers | Future evidence source | Architecture only | None selected | Not run | Discovery until benchmarked |
| MCP | Agent interface | Design only | N/A | Not run | Release only after capability boundaries stabilize |

## Required health states

Every provider adapter must expose a normalized health record:

```text
provider
capability
environment
configured
reachable
authenticated
quota_state
last_success_at
last_failure_at
failure_class
latency_ms
contract_version
checked_at
```

Never expose credentials, raw authorization headers or personal data in a health response.

## Verification ladder

1. **Configuration check** — required variables exist and have valid shape.
2. **Authentication check** — a minimal non-destructive request is accepted.
3. **Contract check** — a recorded or sandbox response maps to the internal adapter schema.
4. **Quality check** — a fixed sample produces reviewed output above the detector/provider threshold.
5. **Failure check** — timeout, rate limit, malformed response and provider outage produce classified retry behavior.
6. **Cost check** — request and successful-output costs are recorded against a run.
7. **Production check** — deployment, secret scope and alerting are verified in the intended environment.

## Release rule

An integration may be marked production-ready only when all seven checks have dated evidence. A valid API key alone is not production readiness. Provider names in code or documentation must not be shown as active to users until the registry says so.

## First audit commands

Run these only after the user supplies the required environment and confirms the target project:

```bash
npm run build
npx vitest run tests --exclude 'tests/e2e/**' --exclude '.claude/**' --exclude '.worktrees/**'
npx tsc -p worker/tsconfig.json --noEmit
npx tsc --noEmit
```

Provider-specific smoke checks must use small fixtures or read-only endpoints and record only sanitized results. Database verification must include real RLS and concurrency tests against a disposable test project or isolated schema.
