# What is required from the founder

This is the only founder-owned setup checklist. Agents may implement adapters, mocks and health checks without credentials, but they cannot create external accounts, accept provider contracts or authorize production spend on your behalf.

## 1. Confirm product pilot choices

The first pilot profile is already accepted as `EN_DISCOVERY_ONLY`. For the no-spend discovery/review slice, provide in one short document or message:

- IntentLead offer and price range used for dogfooding;
- ICP inclusions and exclusions;
- initial review sample size and acceptance target;
- optional buyer-role hypotheses, without identifying or enriching people.

Choose a country/jurisdiction, live-provider budget and possible next geography/category only for a separately authorized later workflow. No live provider spend, contact enrichment or outreach is required or permitted by the current pilot acceptance.

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

## 3. Credentials for later authorized live workflows

No provider credentials are required for the current fixture/mock, zero-spend self-prospecting verification. The following are setup candidates for a separately authorized live path; contact/email credentials additionally require a jurisdiction-specific legal, retention and outreach policy. Do not enable these providers merely because a key exists.

| Service | Later use | Env | Current pilot | Later prerequisite |
|---|---|---|---|---|
| OpenAI | typed live assessment/draft/embeddings if retained | `OPENAI_API_KEY` | not required; fixtures only | approved usage path and explicit zero-spend proof or later spend authorization |
| Reddit | live expressed-intent discovery | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | not required; recorded fixtures | approved app/terms and explicit zero-spend proof or later authorization |
| Exa | live company/entity resolution | `EXA_API_KEY` | not required; recorded fixtures | project key, usage cap and explicit zero-spend proof or later authorization |
| Serper | live fallback web search | `SERPER_API_KEY` | not required; recorded fixtures | confirm Glook ownership/billing and explicit zero-spend proof or later authorization |
| Prospeo | later contact/email | `PROSPEO_API_KEY` | disabled | jurisdiction-specific policy, commercial-use terms and separate authorization |
| Hunter | later fallback find/verify | `HUNTER_API_KEY` | disabled | jurisdiction-specific policy, provider strategy and separate authorization |
| Apollo | later people/email fallback | `APOLLO_API_KEY` | disabled | jurisdiction-specific policy, data license and separate authorization |

Select a contact-provider primary and fallback only for that later jurisdiction-gated workflow, after measured quality/cost review. `EN_DISCOVERY_ONLY` must not call any of them.

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
