import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { redactContactLikePii } from "../providers/normalization";
import type { NoNetworkSelfProspectingFixture } from "./fixture-runtime";

const sanitizedText = (maximum = 2_000) => z.string().trim().min(1).max(maximum).refine(
  value => redactContactLikePii(value) === value,
  "Recorded evidence contains contact-like data",
);
const HttpUrlSchema = z.string().url().refine(value => {
  const url = new URL(value);
  return url.protocol === "https:" && !url.username && !url.password && !url.hash;
}, "Recorded evidence URL must be HTTPS without credentials or fragments");
const ScoreSchema = z.number().min(0).max(1);
const RecordedIdentifierSchema = z.string().trim().min(1).max(300).regex(/^[A-Za-z0-9._:-]+$/);
const CompanyDomainSchema = z.string().max(253).regex(
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i,
);

function containsContactLikeUrlPath(url: URL): boolean {
  let path: string;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return true;
  }
  return redactContactLikePii(path) !== path
    || /(?:^|\/)(?:u|user|users|profile|in)\/[^/]+/i.test(path);
}

const RecordedEvidenceSchema = z.object({
  schemaVersion: z.literal(1),
  version: sanitizedText(120),
  authorization: z.object({
    authorizedFor: z.literal("INTENTLEAD_DOGFOOD"),
    authorizedAt: z.string().datetime(),
    reference: sanitizedText(200),
    sanitized: z.literal(true),
  }).strict(),
  signal: z.object({
    source: z.enum(["reddit", "hackernews"]),
    externalId: RecordedIdentifierSchema,
    sourceUrl: HttpUrlSchema,
    content: sanitizedText(),
    context: sanitizedText().nullable(),
    publishedAt: z.string().datetime().nullable(),
    capturedAt: z.string().datetime(),
  }).strict(),
  company: z.object({
    name: sanitizedText(253),
    domain: CompanyDomainSchema,
    sourceId: RecordedIdentifierSchema,
    sourceUrl: HttpUrlSchema,
    title: sanitizedText(),
    excerpt: sanitizedText(),
    confidence: ScoreSchema,
    capturedAt: z.string().datetime(),
  }).strict(),
  assessment: z.object({
    problemType: z.enum(["website", "local_listing", "reviews", "reputation", "acquisition", "conversion", "operations", "other"]),
    evidenceStrength: ScoreSchema,
    explicitness: ScoreSchema,
    urgency: ScoreSchema,
    commercialImpact: ScoreSchema,
    icpFit: ScoreSchema,
    buyerRelevance: ScoreSchema,
    actionability: ScoreSchema,
    confidence: ScoreSchema,
    reviewReasons: z.array(sanitizedText(120)).min(1).max(6),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.signal.publishedAt && Date.parse(value.signal.capturedAt) < Date.parse(value.signal.publishedAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["signal", "capturedAt"], message: "Capture precedes publication" });
  }
  const signalUrl = new URL(value.signal.sourceUrl);
  const signalHost = signalUrl.hostname.toLowerCase();
  const sourceMatches = value.signal.source === "hackernews"
    ? signalHost === "news.ycombinator.com" && signalUrl.pathname === "/item"
      && /^\d+$/.test(signalUrl.searchParams.get("id") ?? "")
      && [...signalUrl.searchParams.keys()].every(key => key === "id")
      && signalUrl.searchParams.get("id") === value.signal.externalId
    : (() => {
      const redditId = signalUrl.pathname.match(/\/comments\/([A-Za-z0-9_-]+)(?:\/|$)/)?.[1] ?? null;
      return (signalHost === "reddit.com" || signalHost.endsWith(".reddit.com"))
        && signalUrl.search === "" && redditId === value.signal.externalId;
    })();
  if (!sourceMatches || containsContactLikeUrlPath(signalUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["signal", "sourceUrl"], message: "Signal URL does not match its provider or contains personal identity" });
  }
  const companyUrl = new URL(value.company.sourceUrl);
  if (companyUrl.search !== "" || containsContactLikeUrlPath(companyUrl)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["company", "sourceUrl"], message: "Company URL contains query, personal identity or contact-like data" });
  }
});

export function loadRecordedEvidence(path: string | undefined): {
  fixture: NoNetworkSelfProspectingFixture;
  authorization: { authorizedAt: string; reference: string };
} {
  if (!path?.trim()) throw new Error("Missing required worker configuration: SELF_PROSPECTING_RECORDED_EVIDENCE_PATH");
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch {
    throw new Error("Recorded evidence file could not be read");
  }
  const parsed = RecordedEvidenceSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Recorded evidence file is invalid");
  return {
    fixture: parsed.data,
    authorization: {
      authorizedAt: parsed.data.authorization.authorizedAt,
      reference: parsed.data.authorization.reference,
    },
  };
}
