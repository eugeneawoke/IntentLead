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
    pricingRange: "$167–$495+/mo",
    tldr: "Clay is a powerful data enrichment and workflow tool — but it doesn't autonomously find intent signals; you configure triggers or bring a list. IntentLead starts from zero and finds people who already have the pain.",
    strengths: [
      "Extremely powerful enrichment: 150+ data providers in one interface",
      "Flexible workflow builder — conditional logic, formulas, AI columns (Claygent)",
      "Scales well for RevOps teams building complex outbound automation",
    ],
    weaknesses: [
      "Bring-your-own-list by default — no autonomous intent discovery",
      "Steep learning curve: 2–4 weeks to build effective production workflows",
      "Unpredictable credit costs: dual Data Credits + Action Credits system",
      "Signals product requires manual setup — doesn't proactively surface pain",
    ],
    whoFor: {
      competitor: "Clay is for RevOps and technical teams who need sophisticated enrichment workflows on top of existing lead lists or configured signal triggers.",
      intentlead: "IntentLead is for solo founders and small agencies who need to find qualified leads from scratch — people actively expressing pain right now.",
    },
    features: [
      { label: "Autonomous intent signal sourcing (Reddit, HN...)", intentlead: true, competitor: false },
      { label: "4-level pipeline (signal → company → role → email)", intentlead: true, competitor: "Email waterfall + deliverability" },
      { label: "Credit charged only on verified leads", intentlead: true, competitor: "Partial — Data credits refunded; Action credits always consumed" },
      { label: "Personalized message generation", intentlead: true, competitor: "Via AI columns (technical setup required)" },
      { label: "Data enrichment providers", intentlead: "3 providers", competitor: "150+" },
      { label: "Free tier", intentlead: true, competitor: "100 credits/mo, 200 rows max" },
      { label: "Monthly entry price", intentlead: "$39", competitor: "$167 (annual) / $185 (monthly)" },
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
      { label: "4-level verification", intentlead: true, competitor: "Email deliverability only (1 layer)" },
      { label: "Credit only on verified leads", intentlead: true, competitor: false },
      { label: "Personalized message from signal", intentlead: true, competitor: "AI-assisted draft (Claude Haiku)" },
      { label: "Database size", intentlead: "Intent-based", competitor: "275M+ contacts (65-80% accuracy)" },
      { label: "Free tier", intentlead: "10 verified leads", competitor: "100–10k email credits/mo" },
      { label: "Entry paid price", intentlead: "$39/mo", competitor: "$49/user/mo (annual)" },
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
      { label: "Free tier", intentlead: "10 verified leads", competitor: "50 credits/mo" },
    ],
    targetKeywords: ["hunter.io alternative", "hunter io vs intentlead", "email finder with intent signals", "hunter alternative full pipeline"],
  },

  instantly: {
    slug: "instantly",
    name: "Instantly.ai",
    tagline: "Cold email automation and inbox warmup platform",
    pricingRange: "$37–$286+/mo",
    tldr: "Instantly sends emails at scale — IntentLead finds the right people to send to. They're different layers: IntentLead feeds Instantly, not the other way around.",
    strengths: [
      "Excellent inbox warmup and deliverability infrastructure",
      "Unlimited sending accounts on all paid Outreach plans",
      "Catch-all email verification recovers ~300–400 extra contacts per 1,000",
    ],
    weaknesses: [
      "Lead Finder (database) is a separate subscription — base plan has no sourcing",
      "No intent signals or signal-based targeting",
      "Contact limits (not account count) force plan upgrades — Growth capped at 1,000 contacts",
      "Email-only — no LinkedIn, no phone, no multichannel sequences",
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
    pricingRange: "$55–$99+/mo",
    tldr: "Lemlist personalizes and sends outreach at scale — IntentLead finds who to send to, with intent-grounded personalization baked in. Use IntentLead to source; use Lemlist to execute.",
    strengths: [
      "Strong personalization: custom images per lead, liquid variables, AI icebreakers",
      "Multichannel: email + LinkedIn automation + WhatsApp + call reminders",
      "450M+ contact database included on paid plans (Email Pro+)",
    ],
    weaknesses: [
      "Database accuracy ~85-90% and not intent-based — quality varies",
      "Zero signal sourcing from Reddit, HN, or review platforms",
      "Personalization is template-based — lacks why-now context from signals",
      "Per-seat pricing scales fast: 3-person team = $165+/mo (annual) before add-ons",
    ],
    whoFor: {
      competitor: "Lemlist is for teams who already have prospects and need sophisticated multichannel sequencing with visual personalization.",
      intentlead: "IntentLead is for finding the right people first — those actively expressing the pain you solve — then generating a first message grounded in their signal.",
    },
    features: [
      { label: "Intent signal sourcing", intentlead: true, competitor: false },
      { label: "4-level lead verification", intentlead: true, competitor: "Email deliverability only" },
      { label: "Signal-grounded personalization", intentlead: true, competitor: false },
      { label: "Multichannel sequences (LinkedIn, WhatsApp)", intentlead: false, competitor: true },
      { label: "Image/video personalization", intentlead: false, competitor: true },
      { label: "Credit only on verified leads", intentlead: true, competitor: false },
      { label: "Free tier (no card)", intentlead: "10 verified leads", competitor: false },
      { label: "Entry price", intentlead: "$39/mo", competitor: "$55/mo (annual)" },
    ],
    targetKeywords: ["lemlist alternative", "lemlist vs intentlead", "lemlist alternative with lead sourcing"],
  },
};

export const competitorSlugs = Object.keys(competitors) as Array<keyof typeof competitors>;
