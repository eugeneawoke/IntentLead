# Founder actions

**Status:** 2026-10-06.

The local implementation and pre-dogfood quality gate are complete. Task F now has one external input blocker: the controlled sample requires founder-approved product inputs and one authorized recorded-evidence bundle. Synthetic fixture data is not accepted as pilot evidence.

To run the single zero-spend controlled sample, provide or approve:

- the IntentLead offer and price hypothesis used for self-prospecting;
- ICP inclusions and exclusions;
- the first source market/jurisdiction and evidence time window;
- the controlled sample size, acceptance threshold, maximum wrong-company rate and duplicate policy;
- one sanitized recorded-evidence JSON file outside the repository, with its source/company capture timestamps, public source URLs, content excerpts, content identity, explicit `INTENTLEAD_DOGFOOD` authorization timestamp/reference and no unnecessary personal/contact data.

The approved budget for this gate remains zero. The worker accepts the bundle only through explicit `SELF_PROSPECTING_MODE=recorded` and `SELF_PROSPECTING_RECORDED_EVIDENCE_PATH`; live providers remain unreachable.

Before a larger real-source dogfood sample, the founder will additionally need to approve the larger review sample size and any non-zero provider budget.

Production deployment, production migrations, provider spend and billing changes require separate explicit approval.

No mailbox, sending or contact-provider setup is required by the accepted product roadmap.

## Concrete Task F approval

The founder does not need to create JSON, write prompts, start agents or obtain API keys. The implementation agent will collect the approved public pages, sanitize them, build the external recorded-evidence files, run the local worker and prepare the review report.

Recommended first sample, pending founder confirmation:

- **Offer:** IntentLead finds companies with a current, evidence-backed commercial reason to consider a user's offer and produces an inspectable Opportunity for human review. It does not provide contacts or send messages.
- **Commercial hypothesis:** a four-week founder-led paid pilot at USD 500; this is a relevance hypothesis, not a published price or billing change.
- **ICP:** English-speaking B2B SaaS companies, agencies and consultancies with 5–100 employees, a meaningful contract value, founder-led or small sales teams and a need for higher-quality prospect research.
- **Exclude:** consumer businesses, recruiters/contact databases, mass-outbound operations, anonymous companies that cannot be resolved confidently and cases without accessible public evidence.
- **Source/market:** public Hacker News items plus official company pages; English-language companies in the US, UK, Canada and EU; observations from the last 90 days.
- **Sample:** five reviewed Opportunities.
- **Gate:** at least 3/5 accepted, no more than 1/5 wrong-company, zero duplicates, 100% accessible evidence/provenance, zero provider cost and zero stored contact data. Stop on any unsupported material claim or policy breach.

The shortest sufficient founder response is:

> I approve the recommended Task F Offer, price hypothesis, ICP, market, sample and thresholds. I authorize collection of the described public Hacker News and official-company pages for sanitized recorded evidence and a local zero-spend run.

Alternatively, the founder may provide specific Hacker News/company URLs or replace any recommended value. Public-page collection is not authorized until one of these responses is recorded.

## Services, APIs, agents and prompts

- **Already available locally:** repository, worker and disposable Supabase/PostgreSQL environment. No founder setup is required.
- **Used for this gate after approval:** public web pages only, recorded as sanitized evidence. The project runtime does not call a live source/provider API.
- **Not used:** paid OpenAI calls, Reddit API, Hacker News API, Exa, Serper, contact/email providers, mailbox services, billing APIs or production infrastructure.
- **Agents:** the implementation agent runs the sample; independent domain/security/frontend review agents inspect the result. The founder does not start or configure agents.
- **Prompts:** the fixed system instruction and structured assessment contract already live in code. Offer and ICP are structured product inputs, not a prompt the founder must write.
