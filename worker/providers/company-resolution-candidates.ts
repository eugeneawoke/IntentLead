import { z } from "zod";
import {
  PROVIDER_SCHEMA_VERSION,
  type CompanyCandidate,
  type CompanyEvidence,
  type ProviderId,
  type ProviderProvenance,
} from "./contracts";
import { ProviderMalformedResponseError } from "./http";
import { normalizeCompanyRootDomain, normalizePlainText } from "./normalization";

const NormalizedCandidateSchema = z.object({
  companyName: z.string().min(1).max(200),
  companyDomain: z.string().max(253).nullable(),
  confidence: z.number().finite().min(0).max(1),
  resolutionStatus: z.enum(["RESOLVED", "UNCERTAIN", "AMBIGUOUS"]),
  evidence: z.array(z.object({
    providerId: z.enum(["reddit", "hackernews", "exa", "serper"]),
    providerSourceId: z.string().min(1),
    providerRunId: z.string().min(1),
    sourceUrl: z.string().url(),
    title: z.string().min(1),
    excerpt: z.string().min(1),
    capturedAt: z.string().datetime({ offset: true }),
    schemaVersion: z.literal(PROVIDER_SCHEMA_VERSION),
  }).strict()).min(1),
}).strict();

export type SearchEvidence = Omit<CompanyEvidence, "providerRunId">;

function evidenceSupportsDomain(items: SearchEvidence[], domain: string): boolean {
  return items.some(item => normalizeCompanyRootDomain(item.sourceUrl) === domain);
}

function evidenceSupportsName(items: SearchEvidence[], name: string): boolean {
  const normalized = name.toLowerCase();
  return items.some(item => `${item.title} ${item.excerpt}`.toLowerCase().includes(normalized));
}

export function normalizeCandidates(
  raw: unknown,
  searchEvidence: SearchEvidence[],
  providerId: ProviderId,
  providerRunId: string,
): CompanyCandidate[] {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as { candidates?: unknown }).candidates)) {
    throw new ProviderMalformedResponseError();
  }
  const byId = new Map(searchEvidence.map(item => [item.providerSourceId, item]));
  const candidates: CompanyCandidate[] = [];
  const seen = new Set<string>();

  for (const item of (raw as { candidates: Array<{ companyName: string; companyDomain: string | null; confidence: number; evidenceSourceIds: string[] }> }).candidates) {
    const companyName = normalizePlainText(item.companyName, 200);
    const companyDomain = item.companyDomain === null ? null : normalizeCompanyRootDomain(item.companyDomain);
    const evidenceItems = [...new Set(item.evidenceSourceIds)].map(id => byId.get(id));
    if (!companyName || evidenceItems.some(evidence => !evidence)) throw new ProviderMalformedResponseError();
    const validEvidence = evidenceItems as SearchEvidence[];
    if (!evidenceSupportsName(validEvidence, companyName)
      || (companyDomain !== null && !evidenceSupportsDomain(validEvidence, companyDomain))) {
      throw new ProviderMalformedResponseError();
    }
    const identity = `${companyName.toLowerCase()}|${companyDomain ?? ""}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    const evidence = validEvidence.map(value => ({ ...value, providerId, providerRunId }));
    const normalized = NormalizedCandidateSchema.safeParse({
      companyName,
      companyDomain,
      confidence: item.confidence,
      resolutionStatus: "UNCERTAIN",
      evidence,
    });
    if (!normalized.success) throw new ProviderMalformedResponseError();
    candidates.push(normalized.data);
  }

  const ambiguous = candidates.length > 1;
  for (const candidate of candidates) {
    candidate.resolutionStatus = ambiguous
      ? "AMBIGUOUS"
      : candidate.confidence >= 0.7 && candidate.companyDomain !== null ? "RESOLVED" : "UNCERTAIN";
  }
  return candidates;
}

export function evidenceProvenance(evidence: SearchEvidence[], provider: ProviderId, providerRunId: string): ProviderProvenance[] {
  return evidence.map(item => ({
    schemaVersion: PROVIDER_SCHEMA_VERSION,
    providerId: provider,
    providerSourceId: item.providerSourceId,
    providerRunId,
    capturedAt: item.capturedAt,
    sourceUrl: item.sourceUrl,
  }));
}
