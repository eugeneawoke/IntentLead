# IntentLead capability map

**Status:** Accepted target, revised 2026-10-06.

| Capability | Current state | Target | Priority |
|---|---|---|---|
| Workspace authorization | Implemented | One authority boundary for every capability | Core |
| Offer and ICP definition | Partly stored in legacy campaigns | Native versioned OfferProfile and ICPDefinition | Next |
| Discovery brief | Implemented with legacy campaign bridge | Native brief without campaign dependency | Next |
| Durable jobs | Implemented locally | Native Opportunity jobs with recovery and cancellation | Core |
| Provider registry and budgets | Implemented locally | Capability-based selection and zero-spend pilot mode | Core |
| Source normalization | Implemented contracts/adapters | Business-wide SourceItem ingestion | Core |
| Evidence and provenance | Implemented locally | Inspectable evidence for every Opportunity claim | Core |
| Company resolution | Implemented as bounded capability | Measured identity confidence and ambiguity handling | Core |
| Opportunity assessment | Implemented locally | Calibrated QUALIFY/REVIEW/REJECT policy | Core |
| Human review | Implemented locally | Review reasons and quality analytics | Core |
| Self-prospecting worker | Handler exists but is not wired | Runnable fixture/no-network workflow | Next |
| Legacy lead pipeline | Still present but unused | Remove | Next |
| Legacy lead/message UI and API | Still present | Remove or return retired response | Next |
| Website business-context extraction | Not a dedicated capability | Optional extraction of product/audience/positioning only | Later |
| Technical website audit | Exists only through legacy Glook assumptions | Outside accepted product scope | Never |
| Glook snapshot import | Consumer adapter implemented | Dormant optional source, never a pilot dependency | Deferred |
| AI Visibility | Documentation only | Uncommitted research candidate | Deferred |
| Conversation brief/draft | Legacy message generator exists | Remove legacy; reconsider only by explicit product decision | Deferred |
| Sending/mailbox automation | Legacy wording only | Permanently out of scope | Never |
| API/MCP exposure | Architecture draft | Transport over stable application capabilities | Later |

## Priority rule

A capability advances only if it improves evidence-backed Opportunity quality, reviewer usefulness or delivery economics. Source count and generated-contact volume are not success metrics.
