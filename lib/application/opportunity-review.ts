import { isIP } from "node:net";
import { z } from "zod";
import { ApplicationError } from "./errors";
import {
  OpportunityReviewCommandSchema,
  OpportunityReviewDetailSchema,
  OpportunityReviewListItemSchema,
  OpportunityReviewListSchema,
  OpportunityReviewResultSchema,
} from "@/lib/domain/schemas/opportunity-review";
import type {
  OpportunityReviewCommand,
  OpportunityReviewDetail,
  OpportunityReviewList,
  OpportunityReviewResult,
} from "@/types/opportunity-review";

export interface OpportunityReviewCursor {
  createdAt: string;
  id: string;
}

export interface OpportunityReviewRepository {
  list(input: { limit: number; after: OpportunityReviewCursor | null }): Promise<unknown>;
  get(opportunityId: string): Promise<unknown | null>;
  review(opportunityId: string, command: OpportunityReviewCommand): Promise<unknown>;
}

const cursorSchema = z.object({ createdAt: z.string().datetime({ offset: true }), id: z.string().uuid() }).strict();
const listLimit = { minimum: 1, maximum: 50, defaultValue: 20 } as const;
const emailPattern = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/i;
const phonePattern = /(?<!\d)\+?\d[\d(). -]{7,}\d(?!\d)/;
const forbiddenHosts = new Set(["localhost", "localhost.localdomain"]);

function actor(userId: string): void {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new ApplicationError("UNAUTHENTICATED", "Authentication is required");
  }
}

function invalid(message: string): ApplicationError {
  return new ApplicationError("INVALID_INPUT", message);
}

function safeParse<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new ApplicationError("INTERNAL_ERROR", message, { cause: parsed.error });
  return parsed.data;
}

function decodeCursor(value: string): OpportunityReviewCursor {
  if (value.length > 400 || !/^[A-Za-z0-9_-]+$/.test(value)) throw invalid("Invalid pagination cursor");
  try {
    const parsed = cursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
    if (!parsed.success) throw invalid("Invalid pagination cursor");
    return parsed.data;
  } catch (error) {
    if (error instanceof ApplicationError) throw error;
    throw invalid("Invalid pagination cursor");
  }
}

function encodeCursor(cursor: OpportunityReviewCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function parseListQuery(params: URLSearchParams): { limit: number; after: OpportunityReviewCursor | null } {
  const allowed = new Set(["limit", "cursor"]);
  const keys = Array.from(params.keys());
  if (keys.some(key => !allowed.has(key)) || new Set(keys).size !== keys.length) {
    throw invalid("Only one limit and one cursor are allowed");
  }
  const [rawLimit] = params.getAll("limit");
  const [rawCursor] = params.getAll("cursor");
  const limitText = rawLimit ?? String(listLimit.defaultValue);
  if (!/^\d{1,2}$/.test(limitText)) throw invalid("Invalid page size");
  const limit = Number(limitText);
  if (limit < listLimit.minimum || limit > listLimit.maximum) throw invalid("Page size is outside the allowed range");
  return { limit, after: rawCursor ? decodeCursor(rawCursor) : null };
}

function mapFailure(error: unknown, action: string): never {
  if (error instanceof ApplicationError) throw error;
  throw new ApplicationError("INTERNAL_ERROR", action, { cause: error });
}

function privateIp(host: string): boolean {
  const version = isIP(host);
  if (!version) return false;
  if (version === 6) return host === "::1" || host.toLowerCase().startsWith("fc") || host.toLowerCase().startsWith("fd") || host.toLowerCase().startsWith("fe80:");
  const octets = host.split(".").map(Number);
  return octets[0] === 10 || octets[0] === 127 || octets[0] === 0
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
}

function safeSourceUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || forbiddenHosts.has(host)
      || host.endsWith(".localhost") || host.endsWith(".local") || privateIp(host) || isIP(host) || !host.includes(".")
      || url.pathname.includes("%")) return null;
    url.search = "";
    url.hash = "";
    const sanitized = url.toString();
    return emailPattern.test(sanitized) || phonePattern.test(sanitized) ? null : sanitized;
  } catch {
    return null;
  }
}

function safeDetail(raw: unknown): OpportunityReviewDetail {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApplicationError("INTERNAL_ERROR", "Opportunity review data is invalid");
  }
  const candidate = raw as Record<string, unknown>;
  const evidence = Array.isArray(candidate.evidence) ? candidate.evidence.map(entry => {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    return { ...record, sourceUrl: safeSourceUrl(record.sourceUrl) };
  }) : candidate.evidence;
  const baseLimitations = [
    "Evidence facts are shown separately from model interpretation.",
    "This discovery-only review contains no person or contact records.",
  ];
  const evidenceStatus = candidate.evidenceStatus;
  if (evidenceStatus === "PARTIAL" || evidenceStatus === "MISSING") {
    baseLimitations.push("Some referenced evidence is missing or tombstoned.");
  }
  return safeParse(OpportunityReviewDetailSchema, { ...candidate, evidence, limitations: baseLimitations }, "Opportunity review data is invalid");
}

export async function listOpportunitiesForReview(
  userId: string,
  params: URLSearchParams,
  repository: OpportunityReviewRepository,
): Promise<OpportunityReviewList> {
  actor(userId);
  const input = parseListQuery(params);
  try {
    const response = safeParse(z.object({ rows: z.array(z.unknown()).max(listLimit.maximum + 1), hasMore: z.boolean() }).strict(),
      await repository.list(input), "Opportunity list data is invalid");
    const visibleRows = response.rows.slice(0, input.limit);
    const items = visibleRows.map(row => safeParse(OpportunityReviewListItemSchema, row, "Opportunity list data is invalid"));
    const hasMore = response.hasMore && items.length > 0;
    const last = items.at(-1);
    return safeParse(OpportunityReviewListSchema, {
      items,
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
    }, "Opportunity list data is invalid");
  } catch (error) {
    return mapFailure(error, "Could not load Opportunities");
  }
}

export async function getOpportunityForReview(
  userId: string,
  opportunityId: string,
  repository: OpportunityReviewRepository,
): Promise<OpportunityReviewDetail> {
  actor(userId);
  if (!z.string().uuid().safeParse(opportunityId).success) throw new ApplicationError("NOT_FOUND", "Opportunity not found");
  try {
    const result = await repository.get(opportunityId);
    if (result === null) throw new ApplicationError("NOT_FOUND", "Opportunity not found");
    return safeDetail(result);
  } catch (error) {
    return mapFailure(error, "Could not load Opportunity");
  }
}

export async function submitOpportunityReview(
  userId: string,
  opportunityId: string,
  rawCommand: unknown,
  idempotencyHeader: string | null,
  repository: OpportunityReviewRepository,
): Promise<OpportunityReviewResult> {
  actor(userId);
  if (!z.string().uuid().safeParse(opportunityId).success) throw new ApplicationError("NOT_FOUND", "Opportunity not found");
  const parsed = OpportunityReviewCommandSchema.safeParse(rawCommand);
  if (!parsed.success) throw invalid("Invalid review command");
  if (!idempotencyHeader || idempotencyHeader !== parsed.data.idempotencyKey) {
    throw invalid("Idempotency-Key must match the command body");
  }
  try {
    const result = await repository.review(opportunityId, parsed.data);
    return safeParse(OpportunityReviewResultSchema, result, "Review result is invalid");
  } catch (error) {
    return mapFailure(error, "Could not save review");
  }
}
