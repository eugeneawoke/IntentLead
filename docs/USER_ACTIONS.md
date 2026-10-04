# What is required from the founder

This is the only founder-owned setup checklist. Agents may implement adapters, mocks and health checks without credentials, but they cannot create external accounts, accept provider contracts or authorize production spend on your behalf.

## 1. Confirm product pilot choices

Provide in one short document or message:

- first country/jurisdiction and language scope for self-prospecting; use `EN_DISCOVERY_ONLY` only if the run stops before contact enrichment/outreach;
- IntentLead offer and price range used for dogfooding;
- ICP inclusions and exclusions;
- buyer roles to test, without treating them as a permanent allowlist;
- maximum live-provider budget per dogfood run;
- initial review sample size and acceptance target;
- whether one local pilot geography/category will follow, and which one.

## 2. Supabase and Glook ownership

Required:

- confirm the Supabase project used by both products;
- provide access through the normal Supabase organization/project invitation, not by sending secrets in chat;
- identify the Glook repository and owner of the `scans` schema;
- approve the migration from direct table reads to a versioned snapshot API/event;
- identify test users/workspaces for cross-tenant tests.

Connection check:

1. Put local values in `.env.local` from `.env.example`.
2. Run Supabase local/project link using official CLI.
3. Verify anonymous key works only through RLS and service role is server-only.
4. Use two test users to prove foreign workspace/scan denial.

## 3. Required credentials for the first self-prospecting slice

| Service | Why | Env | Required | Obtain/configure |
|---|---|---|---|---|
| OpenAI | typed assessment/draft/embeddings if retained | `OPENAI_API_KEY` | yes for live run | create a project-scoped key in OpenAI dashboard; set budget/alerts |
| Reddit | expressed-intent discovery | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | yes if Reddit is in pilot | register an approved Reddit app; review current API terms |
| Exa | company/entity resolution | `EXA_API_KEY` | recommended | create project key; set usage cap |
| Serper | fallback web search | `SERPER_API_KEY` | optional fallback | reuse only if Glook ownership/billing permits |
| Prospeo | contact/email | `PROSPEO_API_KEY` | one provider required | create project key; confirm commercial use |
| Hunter | fallback find/verify | `HUNTER_API_KEY` | optional | configure only after provider strategy approval |
| Apollo | people/email fallback | `APOLLO_API_KEY` | optional | confirm API/data license and verification semantics |

Do not enable all email providers by default. Pick a primary and one fallback from measured quality/cost.

## 4. Worker and hosting

Required before staging:

- Railway project/service for the worker;
- Vercel project for the web app;
- strong random `WORKER_SECRET` during the current phase, followed by HMAC keys when the new protocol lands;
- project-scoped environment variables in each platform;
- spending alerts and log access.

Do not deploy the current in-memory job model as if it were durable. Staging may be used for bounded smoke only until Phase 0 job work is complete.

## 5. Payments

PayPro is not needed for dogfood. Before a paid pilot, provide product ids, sandbox credentials, webhook/IPN configuration and written charging/refund semantics. Do not activate production billing until idempotent deliverables and ownership-validating credit tests pass.

## 6. Local/CIS pilot, later

For the selected geography/category, decide which provider access you can legally obtain: Yandex Business/Maps, 2GIS, Google Places or another official/partner path. Provide approved credentials or partner access only after the provider matrix records terms, cost and allowed commercial use. Manual evidence collection is acceptable for the first concierge validation.

## 7. AI Visibility pilot, later

Choose engines/surfaces that can be measured legally and reproducibly in the target market. Approve a stable prompt portfolio, repetition frequency and monthly budget. Browser/manual measurement is labeled as such; no agent should invent an API.

## 8. Compliance decisions

Before contacting real prospects, obtain qualified advice for applicable GDPR/ePrivacy, CAN-SPAM, PECR and local advertising/privacy rules. Decide retention, deletion, suppression, opt-out wording and lawful outreach policy. Personalized one-to-one outreach is not automatically lawful merely because the source is public.

## 9. Final production approvals

You personally approve:

- production migrations;
- provider spend caps;
- paid pilot pricing and credit semantics;
- first real prospect list and message batch;
- any assisted sending;
- public MCP access;
- compliance exceptions or residual risks.

## ECC installation completed

ECC 2.2.3 is installed and enabled as the native Codex plugin `ecc@ecc`. Restart/open a new Codex session before expecting its new skills and hooks. Do not run the legacy sync or another ECC installer on top of it.
