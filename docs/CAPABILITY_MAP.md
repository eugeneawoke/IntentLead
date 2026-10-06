# IntentLead capability map

**Status:** Accepted target, revised 2026-10-06.

| Capability | Current state | Target | Priority |
|---|---|---|---|
| Workspace authorization | Implemented | One authority boundary for every capability | Core |
| Offer and ICP definition | Native versioned create contract and persistence | Add editing/version-history UX after pilot evidence | Core |
| Discovery brief | Native create/list/context/run/delete authority; no active campaign dependency | Use as the sole workflow authority | Core |
| Durable jobs | Native DiscoveryBrief enqueue/lifecycle implemented locally | Wire zero-spend handler and preserve recovery/cancellation | Core |
| Provider registry and budgets | Implemented locally | Capability-based selection and zero-spend pilot mode | Core |
| Source normalization | Implemented contracts/adapters | Business-wide SourceItem ingestion | Core |
| Evidence and provenance | Implemented locally | Inspectable evidence for every Opportunity claim | Core |
| Company resolution | Implemented as bounded capability | Measured identity confidence and ambiguity handling | Core |
| Opportunity assessment | Implemented locally | Calibrated QUALIFY/REVIEW/REJECT policy | Core |
| Human review | Implemented locally | Review reasons and quality analytics | Core |
| Self-prospecting worker | Handler exists but is not wired | Runnable fixture/no-network workflow | Next |
| Legacy lead pipeline | Removed from runtime in `523939b` | Keep absent | Complete |
| Legacy lead/message UI and API | Removed in `523939b`; retired routes tested | Keep absent | Complete |
| Website business-context extraction | Not a dedicated capability | Optional extraction of product/audience/positioning only | Later |
| Technical website audit | Removed from active product surfaces | Outside accepted product scope | Never |
| Glook snapshot import | Consumer adapter implemented | Dormant optional source, never a pilot dependency | Deferred |
| AI Visibility | Documentation only | Uncommitted research candidate | Deferred |
| Conversation brief/draft | Legacy generator removed | Reconsider only by explicit product decision | Deferred |
| Sending/mailbox automation | No active product surface or runtime | Permanently out of scope | Never |
| API/MCP exposure | Architecture draft | Transport over stable application capabilities | Later |

## Priority rule

A capability advances only if it improves evidence-backed Opportunity quality, reviewer usefulness or delivery economics. Source count and generated-contact volume are not success metrics.
