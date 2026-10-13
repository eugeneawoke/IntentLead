import {
  DiscoveryBriefSchema, ICPDefinitionContextSchema, MarketProfileSchema, OfferProfileContextSchema,
} from "../../lib/domain/schemas/market-profile";
import { authorizeSelfProspectingCapability } from "../../lib/domain/opportunity-policy";
import type { SelfProspectingContext } from "../../types/self-prospecting";
import type { LeasedJob } from "../jobs/repository";

export function validateSelfProspectingContext(job: LeasedJob, context: SelfProspectingContext) {
  const profile = MarketProfileSchema.parse(context.profile);
  const brief = DiscoveryBriefSchema.parse(context.brief);
  const offer = OfferProfileContextSchema.parse(context.offer);
  const icp = ICPDefinitionContextSchema.parse(context.icp);
  const identityMatches = job.marketProfileId === "EN_DISCOVERY_ONLY" && job.capability === "SOURCE_SEARCH"
    && Boolean(job.discoveryBriefId) && profile.id === "EN_DISCOVERY_ONLY" && profile.workflow === "DISCOVERY_ONLY"
    && brief.id === job.discoveryBriefId && brief.workspaceId === job.workspaceId
    && brief.marketProfileId === profile.id && profile.workspaceId === job.workspaceId
    && offer.id === brief.offerProfileId && icp.id === brief.icpDefinitionId;
  const capabilitiesAllowed = ([
    "SOURCE_SEARCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW",
  ] as const).every(capability => authorizeSelfProspectingCapability(profile, capability).allowed);
  return identityMatches && capabilitiesAllowed ? { profile, brief, offer, icp } : null;
}
