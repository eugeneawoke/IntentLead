# Founder actions

**Status:** 2026-10-10.

There is no current founder-input blocker. Product direction is approved: preserve the established visual language; build multi-source Opportunity discovery through buyer/contact verification and grounded drafting; target at least 20 confirmed signals per complete run; never send messages.

Future live activation is intentionally separate: before any public-source call, the founder must approve the exact provider set and access policy. Official-site access additionally requires a public-egress implementation that enforces company/evidence authority and DNS/private-address/redirect/size controls. This is not required for the current no-network implementation sequence.

The implementation agent owns local code, fixtures, prompts, evals, migrations and reviews. The founder does not need to create JSON files, start agents or select an arbitrary HN-only sample.

## Inputs required later

Only the following external actions require founder involvement:

| Need | Why | When |
|---|---|---|
| Provider account/API credential | Enable a provider that cannot run anonymously | After adapter/health behavior exists and the provider is selected |
| Founder-selected model and credential | Activate conversational intake after its API/UI and approval boundary are locally complete | Before the first live model call; not needed for fixture development |
| Source terms/legal decision | Confirm an ambiguous commercial-use or regional access path | Before enabling that source live |
| Non-zero provider budget | Authorize paid search, enrichment, verification or model calls | Before the first paid call |
| Production deployment | Publish app/worker changes | After local milestone gate |
| Production migration | Apply forward-only schema changes to production | After migration/RLS/rollback review |
| Pricing decision | Publish plans or connect billing | After product-value and unit-economics evidence |

## Provider setup format

When a credential becomes necessary, the implementation report must state:

```text
SERVICE
WHY NEEDED
ENV VARIABLE
WHERE TO GET IT
CURRENT FREE/PAID STATUS
REQUIRED OR OPTIONAL
EXPECTED REQUEST/CREDIT BUDGET
LEGAL/ACCESS NOTES
```

Free tiers and prices are not assumed stable; they must be checked against current official provider documentation at enablement time.

## Still prohibited in the current stage

- production deploy or production migration;
- any paid provider/API/model call;
- sending a real email, DM, Telegram message or other communication;
- mailbox connection, sequences or follow-ups;
- billing mutation.

Contacts and grounded drafts are part of the product result. Transmission is not.
