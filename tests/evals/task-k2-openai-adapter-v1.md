# Task K2 OpenAI adapter V1 eval

**Defined:** 2026-10-10, before implementation.
**Scope:** provider adapter foundation only. No API/UI, live model call, paid spend, production migration or deployment.

## Capability evals

- [x] The adapter uses the OpenAI Responses API and strict JSON Schema output.
- [x] The registry-owned system instruction and untrusted user payload remain separate inputs.
- [x] No tools, web search, tool choice, background execution or response storage are enabled.
- [x] The registry reservation is consumed exactly once before the client can be called.
- [x] The caller's `AbortSignal` and a zero-retry policy reach the SDK request options.
- [x] The registry fingerprint binds the full adapter payload and prompt version/hash; it is not presented as HTTP idempotency.
- [x] A conservative UTF-8 byte upper bound rejects payloads that could exceed the reserved input-token ceiling before invocation.
- [x] Completed JSON output and input/output token usage are returned without changing domain meaning.
- [x] Refusal, incomplete/failed status, missing usage, empty output and malformed JSON fail closed.

## Regression evals

- [x] `openai` remains `paid_locked` in the trusted catalog and cannot be invoked through `executeModel`.
- [x] Existing fixture-only structured intake remains deterministic and no-network.
- [x] Existing model policy, evidence, budget and timeout guards remain effective.
- [x] No credential, model or price default silently activates a live call.
- [x] Adapter construction requires an explicit strict-Structured-Outputs compatibility assertion for the exact model.
- [x] The response model must match the authorized model and the provider response id is retained in the model-run envelope.

## Grading and gate

- Deterministic Vitest graders cover request shape, output handling, reservation use and locked-catalog denial.
- App and worker TypeScript checks must pass; lint is limited to changed code.
- GitNexus impact must stay below HIGH before edits and `detect_changes` must match the intended model flow before commit.
- Independent post-fix review must verify the complete adapter-to-registry success and failure provenance/accounting boundary.

**Pass condition:** every checklist item passes without a live OpenAI request.

## Result — 2026-10-10

- Focused model gate: 25/25 passed.
- App and worker typechecks: passed.
- Targeted lint: passed with zero errors and zero warnings after cleanup.
- Live calls and cost: 0.
- Independent post-fix review: passed after correcting the initial blocker that discarded provider response provenance and known usage on rejection paths.
- HTTP/provider deduplication is not claimed by this slice; durable invocation deduplication remains a gate before changing OpenAI from `paid_locked`.
