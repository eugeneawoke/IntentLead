import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { parse as parseDomain } from "tldts";
import { z } from "zod";
import { IdSchema, TimestampSchema } from "./common";

const SnapshotIdSchema = IdSchema.max(128).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const SnapshotText = (max: number) => z.string().min(1).max(max).refine(value => /\S/.test(value), "Expected non-blank text");
const ContentDigestSchema = z.string().regex(/^[a-f0-9]{64}$/);

function isCanonicalPublicHttpsUrl(value: string): boolean {
  if (value !== value.trim() || value.length > 2048) return false;
  try {
    const url = new URL(value);
    const host = url.hostname;
    const labels = host.split(".");
    const topLevelDomain = labels.at(-1) ?? "";
    const publicDomain = parseDomain(host, { allowIcannDomains: true, allowPrivateDomains: false });
    const forbiddenDomains = ["localhost", "local", "internal", "test", "example", "invalid", "onion"];
    return url.protocol === "https:"
      && !url.username && !url.password && !url.search && !url.hash && !url.port
      && url.toString() === value
      && host === host.toLowerCase() && !host.endsWith(".")
      && !isIP(host) && !host.includes("xn--")
      && labels.length >= 2 && labels.every(label => label.length > 0 && label.length <= 63
        && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))
      && Boolean(publicDomain.domain) && publicDomain.isIcann === true && publicDomain.isIp !== true
      && /^[a-z]{2,63}$/.test(topLevelDomain)
      && !forbiddenDomains.includes(topLevelDomain)
      && !host.endsWith(".localhost") && !host.endsWith(".local")
      && !host.endsWith(".internal") && !host.endsWith(".home.arpa");
  } catch {
    return false;
  }
}

export const GlookSiteUrlSchema = z.string().url().refine(isCanonicalPublicHttpsUrl, "Expected a canonical public HTTPS site URL");

const BusinessFactsSchema = z.object({
  kind: z.literal("SOURCE_FACTS"),
  detectedService: SnapshotText(300).nullable(),
  targetAudience: SnapshotText(300).nullable(),
  businessProfile: SnapshotText(1200).nullable(),
}).strict();

const InterpretationSchema = z.object({
  kind: z.literal("GENERATED_INTERPRETATION"),
  aiSummary: SnapshotText(3000).nullable(),
  topPriorities: z.array(SnapshotText(300)).max(3),
}).strict();

const RedactedBusinessFactsSchema = z.object({
  kind: z.literal("SOURCE_FACTS"),
  detectedService: z.null(),
  targetAudience: z.null(),
  businessProfile: z.null(),
}).strict();

const RedactedInterpretationSchema = z.object({
  kind: z.literal("GENERATED_INTERPRETATION"),
  aiSummary: z.null(),
  topPriorities: z.tuple([]),
}).strict();

const snapshotMetadata = {
  schemaVersion: z.literal(1),
  producer: z.literal("GLOOK"),
  snapshotId: SnapshotIdSchema,
  idempotencyKey: ContentDigestSchema,
  scanId: SnapshotIdSchema,
  subjectUserId: SnapshotIdSchema,
  scanCompletedAt: TimestampSchema,
  issuedAt: TimestampSchema,
  expiresAt: TimestampSchema,
  provenance: z.object({ source: z.literal("GLOOK_SCAN_RESULT") }).strict(),
};

export const ActiveSiteContextSnapshotBodySchema = z.object({
  ...snapshotMetadata,
  redactionState: z.literal("ACTIVE"),
  siteUrl: GlookSiteUrlSchema,
  businessContext: BusinessFactsSchema,
  interpretation: InterpretationSchema,
}).strict();

export const RedactedSiteContextSnapshotBodySchema = z.object({
  ...snapshotMetadata,
  redactionState: z.literal("REDACTED"),
  redactedAt: TimestampSchema,
  siteUrl: z.null(),
  businessContext: RedactedBusinessFactsSchema,
  interpretation: RedactedInterpretationSchema,
}).strict();

export const SiteContextSnapshotBodySchema = z.discriminatedUnion("redactionState", [
  ActiveSiteContextSnapshotBodySchema,
  RedactedSiteContextSnapshotBodySchema,
]);

export type SiteContextSnapshotBody = z.infer<typeof SiteContextSnapshotBodySchema>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  // V1 sorts object keys by code point and preserves array order for cross-language digest parity.
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
}

export function computeSiteContextSnapshotDigest(body: SiteContextSnapshotBody): string {
  return createHash("sha256").update(stableJson(body), "utf8").digest("hex");
}

export function deriveGlookSnapshotId(scanId: string): string {
  return `glook-site-context-v1-${scanId}`;
}

export function deriveGlookSnapshotIdempotencyKey(scanId: string): string {
  return createHash("sha256").update(`GLOOK|site-context-snapshot|v1|${scanId}`, "utf8").digest("hex");
}

export const SiteContextSnapshotSchema = z.discriminatedUnion("redactionState", [
  ActiveSiteContextSnapshotBodySchema.extend({ producerContentDigest: ContentDigestSchema }).strict(),
  RedactedSiteContextSnapshotBodySchema.extend({ producerContentDigest: ContentDigestSchema }).strict(),
]).superRefine((snapshot, ctx) => {
  const completedAt = Date.parse(snapshot.scanCompletedAt);
  const issuedAt = Date.parse(snapshot.issuedAt);
  const expiresAt = Date.parse(snapshot.expiresAt);
  const ordered = completedAt <= issuedAt && issuedAt < expiresAt;
  if (!ordered) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Snapshot timestamps are out of order" });
  if (snapshot.redactionState === "REDACTED"
    && (Date.parse(snapshot.redactedAt) < completedAt || Date.parse(snapshot.redactedAt) > issuedAt)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["redactedAt"], message: "Redaction time is outside the snapshot chronology" });
  }
  if (snapshot.snapshotId !== deriveGlookSnapshotId(snapshot.scanId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["snapshotId"], message: "Snapshot identity is not derived from the scan" });
  }
  if (snapshot.idempotencyKey !== deriveGlookSnapshotIdempotencyKey(snapshot.scanId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["idempotencyKey"], message: "Snapshot idempotency identity is invalid" });
  }
  const body = Object.fromEntries(Object.entries(snapshot).filter(([key]) => key !== "producerContentDigest"));
  if (snapshot.producerContentDigest !== computeSiteContextSnapshotDigest(body as SiteContextSnapshotBody)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["producerContentDigest"], message: "Snapshot content digest does not match its payload" });
  }
});
