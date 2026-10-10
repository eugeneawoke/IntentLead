# IntentLead product model

**Status:** Accepted, corrected 2026-10-06 from founder source materials and implementation feedback.

## Product

IntentLead is an Opportunity Intelligence Engine. It finds businesses with a concrete, defensible reason to consider a user's offer, identifies the most relevant buyer, verifies an available business contact and prepares an evidence-grounded conversation brief or draft.

IntentLead is not a generic contact database, AI SDR, sender, CRM, Reddit/Hacker News finder, social-listening dashboard, website-audit suite or standalone AI Visibility product.

## Core outcome

```text
user offer + ICP + market
→ source plan
→ observed signal, event or commercial problem
→ evidence and provenance
→ company resolution
→ Opportunity assessment
→ buyer resolution
→ verified contact
→ grounded conversation brief or draft
→ human review and manual action
```

An accepted Opportunity package answers:

1. Which business is this?
2. What happened or what was observed?
3. What evidence supports it and how can the user inspect it?
4. Why could it matter commercially?
5. Why is it relevant to this user's offer and ICP?
6. Why may the timing matter now?
7. Who is the most relevant buyer or decision maker?
8. Which public business contact can be verified, and from which source?
9. What can the user say without inventing facts?
10. What is known, inferred and still uncertain?

## Intelligence domains

- **Expressed intent:** public requests, comparisons, complaints, replacement searches and stated manual-process pain.
- **Business events:** hiring, funding, launches, expansion, leadership or technology change.
- **Detected commercial problems:** observable operational, acquisition, conversion, reputation or market gaps.
- **Customer and market evidence:** reviews, recurring complaints, competitor changes and category dynamics.
- **Local-business evidence:** maps, listings, review patterns, contact consistency, availability and other market-appropriate observations.
- **Business-presence evidence:** public website, directory, search or AI-answer observations when relevant to the user's offer.

A website may be read to understand a business and to verify a concrete commercially relevant observation. A universal technical, SEO or AI-readiness audit is not a mandatory stage. No signal by itself proves readiness to buy.

## First workflow

The first workflow is IntentLead self-prospecting under `EN_DISCOVERY_ONLY`.

`EN_DISCOVERY_ONLY` means:

- discovery, evidence, company resolution, assessment, buyer resolution, contact verification and grounded drafting are allowed;
- contacts are shown only when their source and current business relevance are verifiable;
- the founder decides whether and how to act;
- mailbox connection, automatic sending, sequences, follow-ups and delivery tracking are disabled;
- paid provider calls and production changes remain separately gated.

The user-facing target for a complete run is at least **20 confirmed, evidence-backed signals** after validation. The product reports both signal count and the number of unique companies/Opportunities after entity resolution and deduplication; it never pads the result with weak candidates.

## Market and source model

The source plan is generated from the offer, ICP, business type, geography, language, access policy and budget. IntentLead is not hard-coded to one community or one market.

The primary intake is conversational: a user describes what they sell and whom they want to find in normal language. A bounded LLM converts that input into reviewable structured constraints and explains uncertainties; it does not invent evidence or autonomously choose paid sources.

Initial provider families include:

- community and developer sources;
- search and public web;
- reviews and comparison platforms;
- jobs, company events, news and technology changes;
- local maps, directories and regional public sources;
- official company websites;
- people and business-contact discovery;
- email finding and verification.

Global, CIS and local-business markets use the same domain model with different `MarketProfile` capabilities. The initial live portfolio is free and lawful. Expensive search or enrichment remains locked until demand is demonstrated, then runs only after cheap qualification and within an explicit approved budget.

## Product promises

- Every material claim is traceable to evidence.
- Facts, inference and uncertainty are visibly distinct.
- Company, buyer and contact resolution expose confidence and source.
- Missing contact is reported honestly; no address, identity or role is invented.
- Rejection and insufficient evidence are valuable outcomes.
- Sources, vendors and markets are replaceable implementation details.
- Cost, freshness, confidence and limitations are visible.
- Generated drafts may contain only claims grounded in referenced evidence.
- No message is sent by IntentLead.

## Success model

Primary quality metric:

`human-accepted, contact-worthy Opportunity packages / reviewed Opportunity packages`

Supporting metrics:

- confirmed signals and unique companies per run;
- company-resolution accuracy;
- buyer-resolution accuracy;
- verified-contact rate;
- evidence sufficiency, accessibility and freshness;
- unsupported material claims (zero tolerance);
- duplicate rate;
- draft grounding accuracy;
- cost and latency per accepted Opportunity;
- repeat usage and willingness to pay.

Outcome feedback may later record whether the user manually contacted a company and what happened. It never authorizes automatic outreach.

## Validation sequence

1. Restore the established visual language and correct the product contract.
2. Run a reproducible self-prospecting slice with recorded or free authorized sources.
3. Prove at least 20 confirmed signals and inspect the resulting unique Opportunity packages.
4. Calibrate source quality, company/buyer/contact resolution and draft grounding.
5. Test the workflow with design partners in global and CIS/local profiles.
6. Decide pricing from demonstrated value and delivery economics; no current price is accepted.

## Permanent non-goals

- automatic or assisted sending from IntentLead;
- mailbox automation, sequences, follow-ups and delivery tracking;
- spam or high-volume undifferentiated list production;
- a giant proprietary people database;
- a universal CRM;
- a generic website, SEO or AI Visibility product;
- treating public availability as permission for unrestricted collection or use;
- unsupported causal, revenue-loss or purchase-readiness claims.
