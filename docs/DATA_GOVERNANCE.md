# Data governance

## Data classes

1. Tenant/account: identity, membership, entitlements.
2. Business configuration: offers, ICP, market and prompts.
3. Public source content: URLs, excerpts and captured facts.
4. Personal/contact data: names, roles, profiles, emails and verification.
5. Generated interpretation: assessments, buyer hypotheses and drafts.
6. Operational: jobs, provider runs, costs and logs.
7. Suppression/compliance: opt-outs, legal basis and policy decisions.

## Rules

- Collect the minimum needed for the declared workflow.
- Record source, capture time, access classification and provenance.
- Keep raw facts separate from generated interpretation.
- Do not log plaintext emails or full provider payloads in general logs.
- Apply workspace-scoped access and RLS.
- Evidence artifacts are append-only during their permitted retention window and use content hashes and controlled access. Immutability does not override a valid deletion obligation.
- Suppression data survives normal campaign cleanup as required to honor opt-out.
- Deletion/export procedures cover relational data, object artifacts, derived embeddings/evaluation copies and supported backups. Deletion may replace required audit references with a tombstone/redacted record.
- Retention differs by data class and market; values require product/legal decision before production pilot.
- Suppression records retain the minimum irreversible or pseudonymized identifier needed to honor an opt-out under the applicable policy; they are not deleted through ordinary campaign cleanup.

The first dogfood milestone must not create object artifacts, embeddings or copied evaluation records from live personal/source data unless their deletion adapters and end-to-end deletion test exist. Relational dogfood data requires an owner-triggered deletion workflow; supported backup expiry is documented and verified with the infrastructure provider rather than claimed as synchronous deletion.

## Research and model use

Provider/model terms must permit the intended processing. Sensitive data is not sent to a model unless necessary, documented and covered by policy. Evaluation datasets use sanitized or consented data.

## Auditability

Store who/what created an assessment or draft, model/provider version, schema version, evidence references and any human override. Corrections append new versions; they do not rewrite evidence history.
