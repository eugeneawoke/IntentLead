export interface NoNetworkSelfProspectingFixture {
  version: string;
  signal: {
    source: "reddit" | "hackernews";
    externalId: string;
    sourceUrl: string;
    content: string;
    context: string | null;
    publishedAt: string | null;
    capturedAt?: string;
  };
  company: {
    name: string;
    domain: string;
    sourceId: string;
    sourceUrl: string;
    title: string;
    excerpt: string;
    confidence: number;
    capturedAt?: string;
  };
  assessment: {
    problemType: "website" | "local_listing" | "reviews" | "reputation" | "acquisition" | "conversion" | "operations" | "other";
    evidenceStrength: number;
    explicitness: number;
    urgency: number;
    commercialImpact: number;
    icpFit: number;
    buyerRelevance: number;
    actionability: number;
    confidence: number;
    reviewReasons: readonly string[];
  };
}
