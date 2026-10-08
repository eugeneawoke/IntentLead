# MCP architecture boundary

**Status:** Future transport; no public MCP implementation is authorized.

MCP will expose stable application capabilities rather than duplicate business logic.

Potential tools/resources after Opportunity Core stabilizes:

- create or inspect a DiscoveryBrief;
- start and inspect a discovery job;
- list/get Opportunities;
- get EvidenceItems and provenance;
- inspect buyer candidates and verified contact points;
- get a grounded conversation brief/draft for copy/export;
- record a ReviewDecision;
- inspect provider health, cost and limitations.

Every operation is typed, workspace-aware, permission-checked, budgeted and auditable. Long operations return a durable job id. Providers remain hidden behind capabilities.

MCP does not expose sending, mailbox, sequence or delivery capabilities. It cannot bypass application authorization or evidence policy.
