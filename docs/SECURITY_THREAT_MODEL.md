# Security threat model

## Protected assets

Workspace isolation, Offer/ICP data, discovery briefs, evidence artifacts, company records, Opportunity decisions, provider credentials, budgets, prompts/model outputs and audit history.

## Trust boundaries

- browser → Next.js application;
- application → Supabase;
- application → Railway worker;
- worker → external sources/providers;
- optional external product snapshot → IntentLead importer;
- untrusted public content → normalization/reasoning.

## Required controls

| Risk | Control | Verification |
|---|---|---|
| Cross-tenant access | auth-derived workspace, RLS, owner-checked RPCs | negative two-tenant tests |
| Service-role bypass | narrow server modules; authorization before access | route/repository tests |
| Worker replay/forgery | request-bound HMAC, timestamp, nonce and persisted replay claim | auth/replay tests |
| SSRF and redirect abuse | URL policy, private-address denial and DNS rebinding checks | adversarial fetch tests |
| Prompt/evidence injection | content treated as data, typed outputs, evidence never model-created | injection fixtures |
| Evidence poisoning | immutable source/hash/time/provenance and separate interpretation | tamper tests |
| Cost/network escape | injected providers, budget checks and no-network test mode | zero-spend tests |
| Stored XSS/unsafe URLs | validation, sanitization and safe rendering | API/component tests |
| Sensitive logging | structured allowlist and redaction | log-capture tests |
| Destructive deletion gaps | owner-bound delete/redaction with serialized terminal writes | DB integration tests |

Public availability does not imply unrestricted commercial use. Every source declares access and retention policy. The current workflow performs no external communication.

No production release until RLS, worker replay, SSRF, injection, evidence integrity, redaction, deletion and budget controls pass independent review.
