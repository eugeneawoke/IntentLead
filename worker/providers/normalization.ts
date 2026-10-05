import { createHash } from "node:crypto";
import { domainToASCII } from "node:url";
import { isIP } from "node:net";
import type { ProviderId } from "./contracts";

const TRACKING_QUERY_KEYS = new Set(["fbclid", "gclid", "mc_cid", "mc_eid"]);
const COMPOUND_PUBLIC_SUFFIXES = new Set([
  "ac.uk", "co.in", "co.jp", "co.nz", "co.uk", "co.za", "com.au", "com.br", "com.cn",
  "com.hk", "com.mx", "com.sg", "com.tr", "com.tw", "gov.uk", "net.au", "org.au", "org.uk",
]);

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
  return value
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, decodeEntity)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizePublicSignalText(value: string, maxLength: number): string {
  return normalizePlainText(value, maxLength)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email redacted]")
    .replace(/(^|[\s([{])@[\w.-]{2,}/g, "$1[author redacted]");
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
    const labels = asciiHost.replace(/^www\./, "").split(".");
    if (labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return null;
    const suffix = labels.slice(-2).join(".");
    const rootLabels = COMPOUND_PUBLIC_SUFFIXES.has(suffix) ? 3 : 2;
    if (labels.length < rootLabels) return null;
    return labels.slice(-rootLabels).join(".");
  } catch {
    return null;
  }
}

export function sanitizeCompanySignal(value: string, maxLength = 500): string {
  return normalizePlainText(value, maxLength)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/@[\w.-]{2,}/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function stableProviderSourceId(provider: ProviderId, identity: string): string {
  return `${provider}:${sha256(identity).slice(0, 24)}`;
}
