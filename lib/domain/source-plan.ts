import { SourcePlanRequestSchema, SourcePlanSchema } from "./schemas/source-plan";
import type { SourceCatalogEntry, SourcePlan, SourcePlanRequest } from "../../types/source-plan";

function languageMatches(supported: string[], requested: string[]): boolean {
  return supported.includes("*") || requested.some(language => supported.includes(language.toLowerCase()));
}

function gapReason(entry: SourcePlan["selected"][number], request: SourcePlanRequest): SourcePlan["gaps"][number]["reason"] | null {
  if (entry.legalStatus === "PROHIBITED") return "PROHIBITED";
  if (entry.legalStatus === "UNASSESSED") return "LEGAL_UNASSESSED";
  if (entry.state !== "READY") return entry.state;
  const cost = entry.configuredCost;
  if (cost.currency !== request.budget.currency || cost.amount > request.budget.maxCost) return "BUDGET_EXCEEDED";
  return null;
}

export function buildSourcePlan(requestInput: SourcePlanRequest, catalogInput: SourceCatalogEntry[]): SourcePlan {
  const request = SourcePlanRequestSchema.parse(requestInput);
  const relevant = catalogInput.filter(entry => (
    entry.marketProfileIds.includes(request.marketProfileId)
    && languageMatches(entry.languages, request.languages)
    && (entry.businessTypes.includes("ALL") || entry.businessTypes.includes(request.businessType))
    && entry.signalFamilies.some(family => request.signalFamilies.includes(family))
  ));

  const selected = relevant.sort((left, right) => (
    left.configuredCost.amount - right.configuredCost.amount
    || left.priority - right.priority
    || left.providerKey.localeCompare(right.providerKey)
  )).slice(0, request.maxProviders).map(entry => {
    const matchingFamilies = entry.signalFamilies.filter(family => request.signalFamilies.includes(family));
    const [firstFamily, ...remainingFamilies] = matchingFamilies;
    if (!firstFamily) throw new Error(`Source ${entry.providerKey} has no matching signal family`);
    const signalFamilies: SourcePlan["selected"][number]["signalFamilies"] = [firstFamily, ...remainingFamilies];
    return {
      providerKey: entry.providerKey,
      sourceFamily: entry.sourceFamily,
      accessMode: entry.accessMode,
      state: entry.state,
      legalStatus: entry.legalStatus,
      costClass: entry.costClass,
      configuredCost: entry.configuredCost,
      signalFamilies,
      priority: entry.priority,
      rationale: entry.rationale,
    };
  });

  const gaps: SourcePlan["gaps"] = [];
  const executable = selected.filter(entry => {
    const reason = gapReason(entry, request);
    if (reason) gaps.push({ providerKey: entry.providerKey, reason });
    return reason === null;
  });
  const executableFamilies = new Set(executable.map(entry => entry.sourceFamily)).size;

  return SourcePlanSchema.parse({
    schemaVersion: 1,
    id: request.id,
    workspaceId: request.workspaceId,
    discoveryBriefId: request.discoveryBriefId,
    marketProfileId: request.marketProfileId,
    requestedConfirmedSignals: request.requestedConfirmedSignals,
    status: executable.length === 0 ? "BLOCKED" : executableFamilies >= 3 ? "READY" : "PARTIAL",
    selected,
    executable,
    gaps,
    createdAt: request.createdAt,
  });
}
