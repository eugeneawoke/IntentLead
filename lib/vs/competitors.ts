export interface CompetitorFeature {
  label: string;
  intentlead: true | false | string;
  competitor: true | false | string;
}

export interface CompetitorData {
  slug: string;
  name: string;
  tagline: string;
  pricingRange: string;
  tldr: string;
  strengths: string[];
  weaknesses: string[];
  whoFor: { competitor: string; intentlead: string };
  features: CompetitorFeature[];
  targetKeywords: string[];
}

export const competitors: Record<string, CompetitorData> = {
  clay: {
    slug: "clay",
    name: "Clay",
    tagline: "Enrichment orchestration platform for data-driven outbound",
    pricingRange: "$149–$800+/mo",
    tldr: "Clay is a powerful data enrichment and workflow tool — but it doesn't find intent signals or source leads; you bring the list. IntentLead starts from zero and finds people who already have the pain.",
    strengths: [
      "Extremely powerful enrichment: 75+ data providers in one interface",
      "Flexible workflow builder — conditional logic, formulas, AI columns",
      "Scales well for teams with large existing lead lists",
    ],
    weaknesses: [
      "No signal sourcing — you must already have a list of targets",
      "Complex setup, steep learning curve for non-technical users",
      "Expensive: starts at $149/mo, scales quickly with credit usage",
      "No intent detection — enriches contacts but doesn't find buying signals",
    ],
    whoFor: {
      competitor: "Clay is for ops-heavy teams with existing ICP lists who need sophisticated enrichment and sequence automation.",
      intentlead: "IntentLead is for solo founders and small agencies who need to find qualified leads from scratch — people actively expressing pain right now.",
    },
    features: [
      { label: "Intent signal sourcing (Reddit, HN, VK...)", intentlead: true, competitor: false },
      { label: "4-level lead verification", intentlead: true, competitor: "Partial" },
      { label: "Credit charged only on verified leads", intentlead: true, competitor: false },
      { label: "Personalized message generation", intentlead: true, competitor: "Via AI columns" },
      { label: "Data enrichment (75+ providers)", intentlead: "3 providers", competitor: true },
      { label: "Free tier (no card)", intentlead: true, competitor: false },
      { label: "Monthly entry price", intentlead: "$39", competitor: "$149" },
    ],
    targetKeywords: ["clay alternative", "clay vs intentlead", "clay ai alternative cheap", "clay alternative free"],
  },

  apollo: {
    slug: "apollo",
    name: "Apollo.io",
    tagline: "Sales intelligence platform with a database of 275M+ contacts",
    pricingRange: "$49–$149+/mo",
    tldr: "Apollo gives you a database to search — IntentLead gives you people who are searching right now. Intent signals mean 10x higher relevance than list-based outreach.",
    strengths: [
      "Massive database: 275M+ contacts with email, phone, LinkedIn",
      "Built-in email sequencing and CRM-lite features",
      "Well-established with strong enterprise adoption",
    ],
    weaknesses: [
      "Database-based, not intent-based — contacts aren't actively expressing pain",
      "Email quality is inconsistent — many contacts are stale or unverified",
      "Credits-based model can get expensive quickly at scale",
      "No signal sourcing or why-now context for personalization",
    ],
    whoFor: {
      competitor: "Apollo is for sales teams running high-volume outreach against a defined ICP where list size matters more than signal quality.",
      intentlead: "IntentLead is for teams who care about reply rate — finding 30 people who just said they need your solution beats 3,000 cold database emails.",
    },
    features: [
      { label: "Intent signal sourcing", intentlead: true, competitor: false },
      { label: "Why-now context per lead", intentlead: true, competitor: false },
      { label: "4-level verification", intentlead: true, competitor: "Email verify only" },
      { label: "Credit only on verified leads", intentlead: true, competitor: false },
      { label: "Personalized message from signal", intentlead: true, competitor: "Template sequences" },
      { label: "Database size", intentlead: "Intent-based", competitor: "275M+ contacts" },
      { label: "Free tier", intentlead: "10 verified leads", competitor: "Limited" },
      { label: "Entry paid price", intentlead: "$39/mo", competitor: "$49/mo" },
    ],
    targetKeywords: ["apollo.io alternative", "apollo alternative free", "apollo vs intentlead", "apollo alternative with intent signals"],
  },

  hunter: {
    slug: "hunter",
    name: "Hunter.io",
    tagline: "Email finding and verification tool for outbound teams",
    pricingRange: "$34–$408+/mo",
    tldr: "Hunter finds emails for contacts you already know about — IntentLead finds the contacts first, from intent signals, then finds their emails. Hunter is one step; IntentLead is the full pipeline.",
    strengths: [
      "Reliable email finding and domain search",
      "Clean, simple UX — easy to learn and use",
      "Good API for automation and integration",
    ],
    weaknesses: [
      "Email finding only — no signal sourcing, no company ID, no message generation",
      "You must already know who you're looking for",
      "No intent context — contacts found without buying signals",
    ],
    whoFor: {
      competitor: "Hunter is for teams who already have a prospect list and need to find verified emails for people on it.",
      intentlead: "IntentLead is for teams who need to build the prospect list AND find the email — from intent signals through verified contact to ready-to-send email.",
    },
    features: [
      { label: "Intent signal sourcing", intentlead: true, competitor: false },
      { label: "Company identification", intentlead: true, competitor: false },
      { label: "Contact role verification", intentlead: true, competitor: false },
      { label: "Email finding", intentlead: true, competitor: true },
      { label: "Email verification", intentlead: true, competitor: true },
      { label: "Personalized message generation", intentlead: true, competitor: false },
      { label: "Credit only on verified leads", intentlead: true, competitor: false },
      { label: "Free tier", intentlead: "10 verified leads", competitor: "25 searches/mo" },
    ],
    targetKeywords: ["hunter.io alternative", "hunter io vs intentlead", "email finder with intent signals", "hunter alternative full pipeline"],
  },

  instantly: {
    slug: "instantly",
    name: "Instantly.ai",
    tagline: "Cold email automation and inbox warmup platform",
    pricingRange: "$37–$358+/mo",
    tldr: "Instantly sends emails at scale — IntentLead finds the right people to send to. They're different layers: IntentLead feeds Instantly, not the other way around.",
    strengths: [
      "Excellent inbox warmup and deliverability infrastructure",
      "Unlimited sending accounts on higher plans",
      "AI personalization at scale for existing lead lists",
    ],
    weaknesses: [
      "No lead sourcing — you bring the list, Instantly sends",
      "No intent signals or signal-based targeting",
      "Quality depends entirely on the list quality you feed it",
      "High volume approach risks domain reputation without quality filtering",
    ],
    whoFor: {
      competitor: "Instantly is for teams with existing verified lead lists who need reliable sending infrastructure at high volume.",
      intentlead: "IntentLead is for finding the high-quality leads that Instantly (or any sending tool) will then contact. Use both: IntentLead finds → Instantly sends.",
    },
    features: [
      { label: "Intent signal sourcing", intentlead: true, competitor: false },
      { label: "Lead verification (4 levels)", intentlead: true, competitor: false },
      { label: "Lead generation from scratch", intentlead: true, competitor: false },
      { label: "Email sending/sequences", intentlead: false, competitor: true },
      { label: "Inbox warmup", intentlead: false, competitor: true },
      { label: "Message generation (from signal)", intentlead: true, competitor: "Template-based" },
      { label: "Credit only on verified leads", intentlead: true, competitor: "N/A" },
    ],
    targetKeywords: ["instantly ai alternative with lead finding", "instantly alternative lead generation", "intentlead vs instantly"],
  },

  lemlist: {
    slug: "lemlist",
    name: "Lemlist",
    tagline: "Personalized cold email and multichannel outreach platform",
    pricingRange: "$39–$159+/mo",
    tldr: "Lemlist personalizes and sends outreach at scale — IntentLead finds who to send to, with intent-grounded personalization baked in. Use IntentLead to source; use Lemlist to execute.",
    strengths: [
      "Strong personalization features: custom images, liquid variables, video",
      "Multichannel: email + LinkedIn + phone in one sequence",
      "Has basic lead database (Lemlist Database) for some contact finding",
    ],
    weaknesses: [
      "Lead database is limited and not intent-based",
      "No signal sourcing from Reddit, HN, or review platforms",
      "Personalization is template-based — lacks why-now context from signals",
      "Pricing scales quickly for full multichannel access",
    ],
    whoFor: {
      competitor: "Lemlist is for teams who already have prospects and need sophisticated multichannel sequencing with visual personalization.",
      intentlead: "IntentLead is for finding the right people first — those actively expressing the pain you solve — then generating a first message grounded in their signal.",
    },
    features: [
      { label: "Intent signal sourcing", intentlead: true, competitor: false },
      { label: "4-level lead verification", intentlead: true, competitor: "Email only" },
      { label: "Signal-grounded personalization", intentlead: true, competitor: false },
      { label: "Multichannel sequences", intentlead: false, competitor: true },
      { label: "Image/video personalization", intentlead: false, competitor: true },
      { label: "Credit only on verified leads", intentlead: true, competitor: false },
      { label: "Free tier (no card)", intentlead: "10 verified leads", competitor: false },
      { label: "Entry price", intentlead: "$39/mo", competitor: "$39/mo" },
    ],
    targetKeywords: ["lemlist alternative", "lemlist vs intentlead", "lemlist alternative with lead sourcing"],
  },
};

export const competitorSlugs = Object.keys(competitors) as Array<keyof typeof competitors>;
