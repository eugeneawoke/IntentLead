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

const intentLeadFeatures = {
  evidence: "Evidence with source and provenance",
  company: "Company resolution with uncertainty",
  buyer: "Buyer and contact verification when available",
  draft: "Grounded brief and draft for human review",
  sending: false,
} as const;

export const competitors: Record<string, CompetitorData> = {
  apollo: {
    slug: "apollo",
    name: "Apollo.io",
    tagline: "Sales intelligence platform with a large contact database",
    pricingRange: "$49–$149+/mo",
    tldr: "Apollo starts with a searchable sales database. IntentLead starts with public business evidence and builds a reviewable Opportunity package around why a company may be relevant now.",
    strengths: ["Large searchable company and contact database", "Established sales workflow and enrichment tools", "Built-in sequencing and CRM-oriented features"],
    weaknesses: ["Database records do not by themselves explain why-now relevance", "Contact freshness and verification vary by record", "Its sending workflow solves a different part of the process"],
    whoFor: {
      competitor: "Apollo is suited to sales teams that need a broad database and an integrated outbound workflow.",
      intentlead: "IntentLead is for teams that want evidence-backed Opportunity discovery and a human-reviewed reason to consider each company.",
    },
    features: [
      { label: "Evidence-backed Opportunity discovery", intentlead: intentLeadFeatures.evidence, competitor: "Database and intent products" },
      { label: "Why-now context", intentlead: true, competitor: "Varies by signal source" },
      { label: "Company resolution", intentlead: intentLeadFeatures.company, competitor: true },
      { label: "Buyer/contact work", intentlead: intentLeadFeatures.buyer, competitor: "Database-led" },
      { label: "Grounded brief or draft", intentlead: intentLeadFeatures.draft, competitor: "AI-assisted content" },
      { label: "Automatic sending", intentlead: intentLeadFeatures.sending, competitor: true },
    ],
    targetKeywords: ["apollo.io alternative", "apollo vs intentlead", "evidence based prospecting"],
  },
  clay: {
    slug: "clay",
    name: "Clay",
    tagline: "Enrichment orchestration for data-driven go-to-market work",
    pricingRange: "$167–$495+/mo",
    tldr: "Clay is a flexible enrichment and workflow surface. IntentLead is a narrower Opportunity Intelligence workflow that starts from evidence, resolves a company, and prepares a package for human review.",
    strengths: ["Broad enrichment ecosystem", "Flexible conditional workflows and AI columns", "Useful for technical RevOps teams"],
    weaknesses: ["Requires configuration and workflow design", "Often starts from an existing list or chosen trigger", "Credit use can be difficult to predict across providers"],
    whoFor: {
      competitor: "Clay is for teams building custom enrichment and GTM workflows.",
      intentlead: "IntentLead is for teams that want a guided evidence-to-Opportunity workflow without designing an enrichment graph.",
    },
    features: [
      { label: "Evidence-backed Opportunity discovery", intentlead: intentLeadFeatures.evidence, competitor: "Configurable signals" },
      { label: "Company resolution", intentlead: intentLeadFeatures.company, competitor: "Workflow-defined" },
      { label: "Buyer/contact work", intentlead: intentLeadFeatures.buyer, competitor: "Provider-dependent" },
      { label: "Grounded brief or draft", intentlead: intentLeadFeatures.draft, competitor: "AI-column workflow" },
      { label: "Custom enrichment orchestration", intentlead: false, competitor: true },
      { label: "Automatic sending", intentlead: intentLeadFeatures.sending, competitor: "Via integrations" },
    ],
    targetKeywords: ["clay alternative", "clay vs intentlead", "opportunity intelligence"],
  },
  hunter: {
    slug: "hunter",
    name: "Hunter.io",
    tagline: "Email finding and verification for known companies and contacts",
    pricingRange: "$34–$408+/mo",
    tldr: "Hunter helps find or verify business email addresses. IntentLead covers the earlier evidence and company-resolution work, then attempts buyer and contact verification only when available.",
    strengths: ["Focused email finding and verification", "Simple product experience", "Useful API for established workflows"],
    weaknesses: ["Requires a known company or person", "Does not supply a complete evidence-backed Opportunity assessment", "Contact data alone does not establish commercial relevance"],
    whoFor: {
      competitor: "Hunter is for teams that already know which companies or people they want to reach.",
      intentlead: "IntentLead is for teams that first need to discover and defend why a company is worth reviewing.",
    },
    features: [
      { label: "Evidence-backed Opportunity discovery", intentlead: intentLeadFeatures.evidence, competitor: false },
      { label: "Company resolution", intentlead: intentLeadFeatures.company, competitor: "Domain search" },
      { label: "Buyer/contact work", intentlead: intentLeadFeatures.buyer, competitor: true },
      { label: "Grounded brief or draft", intentlead: intentLeadFeatures.draft, competitor: false },
      { label: "Email verification", intentlead: "When available and authorized", competitor: true },
      { label: "Automatic sending", intentlead: intentLeadFeatures.sending, competitor: "Campaign tools available" },
    ],
    targetKeywords: ["hunter.io alternative", "hunter vs intentlead", "email finder opportunity research"],
  },
  instantly: {
    slug: "instantly",
    name: "Instantly.ai",
    tagline: "Cold-email delivery and campaign operations",
    pricingRange: "$37–$286+/mo",
    tldr: "Instantly is built to execute cold-email programs. IntentLead deliberately stops before sending and concentrates on discovering evidence-backed Opportunities for human action.",
    strengths: ["Sending infrastructure and inbox operations", "Campaign and deliverability tooling", "Designed for established outbound programs"],
    weaknesses: ["Sending is a different layer from Opportunity discovery", "Why-now evidence depends on the data supplied", "High-volume workflow may not fit evidence-first research"],
    whoFor: {
      competitor: "Instantly is for teams with lists and an approved outbound program.",
      intentlead: "IntentLead is for teams that want to decide whom to consider and why before any manual action.",
    },
    features: [
      { label: "Evidence-backed Opportunity discovery", intentlead: intentLeadFeatures.evidence, competitor: false },
      { label: "Company resolution", intentlead: intentLeadFeatures.company, competitor: false },
      { label: "Buyer/contact work", intentlead: intentLeadFeatures.buyer, competitor: "Lead database add-on" },
      { label: "Grounded brief or draft", intentlead: intentLeadFeatures.draft, competitor: "Campaign copy tools" },
      { label: "Sequences and inbox operations", intentlead: false, competitor: true },
      { label: "Automatic sending", intentlead: intentLeadFeatures.sending, competitor: true },
    ],
    targetKeywords: ["instantly alternative", "instantly vs intentlead", "evidence first prospecting"],
  },
  lemlist: {
    slug: "lemlist",
    name: "Lemlist",
    tagline: "Personalized multichannel outreach platform",
    pricingRange: "$55–$99+/mo",
    tldr: "Lemlist specializes in outreach execution and personalization. IntentLead specializes in evidence-backed discovery and hands the final decision and action to a person.",
    strengths: ["Multichannel campaign tools", "Rich personalization options", "Integrated outreach workflow"],
    weaknesses: ["Campaign execution starts after prospect selection", "Personalization is only as sound as its supplied evidence", "Per-seat economics can matter as teams grow"],
    whoFor: {
      competitor: "Lemlist is for teams that already have prospects and need a multichannel execution layer.",
      intentlead: "IntentLead is for teams that need reviewable Opportunities and grounded material before deciding whether to contact anyone.",
    },
    features: [
      { label: "Evidence-backed Opportunity discovery", intentlead: intentLeadFeatures.evidence, competitor: false },
      { label: "Company resolution", intentlead: intentLeadFeatures.company, competitor: "Database-led" },
      { label: "Buyer/contact work", intentlead: intentLeadFeatures.buyer, competitor: "Database-led" },
      { label: "Grounded brief or draft", intentlead: intentLeadFeatures.draft, competitor: "Personalization tools" },
      { label: "Multichannel sequences", intentlead: false, competitor: true },
      { label: "Automatic sending", intentlead: intentLeadFeatures.sending, competitor: true },
    ],
    targetKeywords: ["lemlist alternative", "lemlist vs intentlead", "opportunity discovery"],
  },
};

export const competitorSlugs = Object.keys(competitors) as Array<keyof typeof competitors>;
