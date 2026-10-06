import { OpportunityAssessmentOutputSchema, type OpportunityAssessmentOutput } from "../ai/schemas/opportunity-assessment";
import type { EvidenceItem } from "../../types/evidence";
import type { OpportunitySignal } from "../../types/opportunity";

export interface SignalClassification {
  signal: OpportunitySignal;
  explicit: boolean;
}

export interface EvidenceGroundingSource {
  id: string;
  excerpt: string | null;
  structuredFacts: Record<string, unknown>;
}

function normalized(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function classifySignal(content: string): SignalClassification | null {
  const value = normalized(content);
  const explicit = /\b(?:looking for|seeking|need|needs|recommendation(?:s)? for|any recommendations|searching for|want to find|switching from|alternative to|compare)\b/u.test(value);
  if (explicit) {
    const subtype = /\b(?:switching from|alternative to)\b/u.test(value) ? "switching"
      : /\b(?:compare|comparison)\b/u.test(value) ? "comparison"
        : /\brecommendation|recommendations\b/u.test(value) ? "recommendation_request" : "solution_search";
    return { signal: { family: "EXPRESSED_INTENT", subtype }, explicit: true };
  }
  if (/\b(?:hiring|funding|raised|launched|launching|expanding|expansion|new (?:ceo|cto|leader|location))\b/u.test(value)) {
    const subtype = /\b(?:hiring)\b/u.test(value) ? "hiring"
      : /\b(?:funding|raised)\b/u.test(value) ? "funding"
        : /\b(?:launched|launching)\b/u.test(value) ? "launch" : "expansion";
    return { signal: { family: "BUSINESS_EVENT", subtype }, explicit: false };
  }
  if (/\b(?:broken|missing|inconsistent|error|failed|failure|zero|no reviews|bad reviews|not indexed)\b/u.test(value)) {
    const subtype = /\b(?:review|reviews)\b/u.test(value) ? "reputation"
      : /\b(?:website|indexed|indexing)\b/u.test(value) ? "market_presence" : "operations";
    return { signal: { family: "DETECTED_PROBLEM", subtype }, explicit: false };
  }
  return null;
}

function factValues(value: unknown): string[] {
  if (typeof value === "string" && value.trim()) return [value];
  if (typeof value === "number" && Number.isFinite(value)) return [String(value)];
  if (Array.isArray(value)) return value.flatMap(factValues);
  if (value && typeof value === "object") return Object.values(value).flatMap(factValues);
  return [];
}

export function validateAssessmentGrounding(
  input: unknown,
  evidence: readonly (EvidenceItem | EvidenceGroundingSource)[],
): OpportunityAssessmentOutput {
  const parsed = OpportunityAssessmentOutputSchema.parse(input);
  const byId = new Map(evidence.map(item => [item.id, item]));
  const citedByClaims = parsed.groundedClaims.flatMap(claim => claim.evidenceIds);
  if ([...parsed.evidenceIds, ...citedByClaims].some(id => !byId.has(id))) {
    throw new Error("assessment cites evidence outside the current candidate");
  }
  const statements = new Set<string>();
  for (const claim of parsed.groundedClaims) {
    const text = normalized(claim.text);
    if (statements.has(text)) throw new Error("assessment repeats a factual claim");
    statements.add(text);
    const supported = claim.evidenceIds.some(id => {
      const item = byId.get(id);
      if (!item) return false;
      const anchors = [...(item.excerpt ? [item.excerpt] : []), ...factValues(item.structuredFacts)];
      return anchors.some(anchor => normalized(anchor) === text);
    });
    if (!supported) throw new Error("assessment claim is not an exact normalized evidence fact");
  }
  if (!statements.has(normalized(parsed.problemStatement))) {
    throw new Error("problem statement must be one of the evidence-grounded claims");
  }
  if (parsed.evidenceIds.length !== new Set(parsed.evidenceIds).size
    || parsed.evidenceIds.some(id => !citedByClaims.includes(id))
    || citedByClaims.some(id => !parsed.evidenceIds.includes(id))) {
    throw new Error("assessment evidence references must match its grounded claims");
  }
  return parsed;
}

export function sourceEvidence(signal: { id: string; content: string; structuredFacts?: Record<string, unknown> }): EvidenceGroundingSource {
  return { id: signal.id, excerpt: signal.content, structuredFacts: signal.structuredFacts ?? {} };
}
