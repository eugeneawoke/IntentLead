# Security threat model

## Protected assets

Workspace isolation, Offer/ICP data, discovery briefs, evidence artifacts, company records, buyer/contact research, grounded drafts, Opportunity decisions, provider credentials, budgets, prompts/model outputs and audit history.

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
| Wrong-person/contact leakage | evidence-linked company/role relation, minimization, RLS and redaction | contact/RLS/deletion tests |
| Guessed or stale contact | separate find/verify observations, confidence and freshness | negative contact fixtures |
| Ungrounded personalization | claim-to-evidence links and fail-closed draft validation | draft grounding evals |
| Export abuse | workspace authorization, suppression/policy and bounded export | API/browser tests |
| Cost/network escape | injected providers, budget checks and no-network test mode | zero-spend tests |
| Stored XSS/unsafe URLs | validation, sanitization and safe rendering | API/component tests |
| Sensitive logging | structured allowlist and redaction | log-capture tests |
| Destructive deletion gaps | owner-bound delete/redaction with serialized terminal writes | DB integration tests |

Public availability does not imply unrestricted commercial use. Every source declares access and retention policy. Contact research is not permission to transmit; the workflow performs no external communication.

No production release until RLS, worker replay, SSRF, injection, evidence integrity, redaction, deletion and budget controls pass independent review.
