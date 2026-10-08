export interface LandingDiscoveryDraft {
  schemaVersion: 1;
  offerSummary: string;
  market: "GLOBAL_EN" | "CIS" | "LOCAL_CUSTOM";
  savedAt: string;
}

export const LANDING_DISCOVERY_DRAFT_KEY = "intentlead_discovery_draft_v1";

export interface LandingCopy {
  eyebrow: string;
  headline: string;
  subtitle: string;
  inputLabel: string;
  placeholder: string;
  marketLabel: string;
  markets: Record<LandingDiscoveryDraft["market"], string>;
  submit: string;
  signedInSubmit: string;
  privacy: string;
  siteHint: string;
  noSendHint: string;
  trust: string[];
  journeyEyebrow: string;
  journeyTitle: string;
  journeySubtitle: string;
  journey: Array<{ step: string; title: string; description: string; badge: string }>;
  proofEyebrow: string;
  proofTitle: string;
  proofSubtitle: string;
  packageReady: string;
  packageBoundary: string;
  packageCards: Array<{ label: string; title: string; summary: string; items: string[] }>;
  sourceEyebrow: string;
  sourceTitle: string;
  sourceSubtitle: string;
  sourceGroups: Array<{ title: string; sources: string }>;
  ctaTitle: string;
  ctaSubtitle: string;
  cta: string;
  footerDescription: string;
  footerProduct: string;
  footerLegal: string;
  footerWorkspace: string;
  footerDiscovery: string;
  footerOpportunities: string;
  dock: { home: string; method: string; example: string; start: string };
}
