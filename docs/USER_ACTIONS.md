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
