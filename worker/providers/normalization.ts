import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import { parse as parseDomain } from "tldts";
import type { ProviderId } from "./contracts";

const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()]+/gi;
const HANDLE_RE = /(^|[\s([{])@[\w.-]{2,}/g;
const PHONE_RE = /(?<![\p{L}\p{N}])(?:\+|00)?\d[\d().\s-]{5,}\d(?![\p{L}\p{N}])/gu;

function decodeEntity(match: string, entity: string): string {
  if (entity.startsWith("#x")) {
    const value = Number.parseInt(entity.slice(2), 16);
    return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
  }
  if (entity.startsWith("#")) {
    const value = Number.parseInt(entity.slice(1), 10);
    return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
  }
  const named: Record<string, string> = {
    amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"',
  };
  return named[entity.toLowerCase()] ?? match;
}

export function normalizePlainText(value: string, maxLength: number): string {
  return normalizePlainTextUnbounded(value).slice(0, maxLength);
}

function normalizePlainTextUnbounded(value: string): string {
  return value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePublicSignalText(value: string, maxLength: number): string {
  return redactContactLikePii(normalizePlainTextUnbounded(value)).slice(0, maxLength);
}

export function redactContactLikePii(value: string): string {
  return value
    .replace(EMAIL_RE, "[email redacted]")
    .replace(URL_RE, "[URL redacted]")
    .replace(HANDLE_RE, "$1[author redacted]")
    .replace(PHONE_RE, redactPhoneMatch);
}

export function normalizeHttpUrl(value: string, baseUrl?: string): string | null {
  try {
    const parsed = baseUrl ? new URL(value, baseUrl) : new URL(value);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return null;
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      const normalizedKey = key.toLowerCase();
      if (normalizedKey.startsWith("utm_") || TRACKING_QUERY_KEYS.has(normalizedKey)) parsed.searchParams.delete(key);
    }
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    return parsed.toString();
  } catch {
    return null;
  }
}

export function normalizeCompanyRootDomain(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2_048) return null;
  const urlInput = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(urlInput);
    if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.username || parsed.password) return null;
    const asciiHost = domainToASCII(parsed.hostname.toLowerCase().replace(/\.$/, ""));
    if (!asciiHost || isIP(asciiHost) || asciiHost.length > 253) return null;
    const labels = asciiHost.split(".");
    if (labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return null;
    const parsedDomain = parseDomain(asciiHost, { allowIcannDomains: true, allowPrivateDomains: true });
    if (!parsedDomain.domain || (!parsedDomain.isIcann && !parsedDomain.isPrivate) || parsedDomain.isIp) return null;
    return parsedDomain.domain;
  } catch {
    return null;
  }
}

export function sanitizeCompanySignal(value: string, maxLength = 500): string {
  return normalizePlainTextUnbounded(value)
    .replace(EMAIL_RE, " ")
    .replace(URL_RE, " ")
    .replace(/@[\w.-]{2,}/g, " ")
    .replace(PHONE_RE, redactPhoneMatch)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function redactPhoneMatch(match: string): string {
  const trimmed = match.trim();
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed) || /^\d{4}[–-]\d{4}$/.test(trimmed)) return match;
  const digits = trimmed.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? "[phone redacted]" : match;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableProviderSourceId(provider: ProviderId, identity: string): string {
  return `${provider}:${sha256(identity).slice(0, 24)}`;
}
