import type { CapabilityError } from "../../types/job";
import type { SourcePlan } from "../../types/source-plan";
import { SourcePlanSchema } from "../../lib/domain/schemas/source-plan";
import {
  type DiscoveredSignal,
  type ProviderBudget,
  type ProviderRunEnvelope,
  type ProviderSelectionRequest,
  type SignalSourceAdapter,
} from "./contracts";
import { executeProviderWithFallback } from "./registry-execution";

export interface SourcePortfolioResult {
  signals: DiscoveredSignal[];
  providerRuns: ProviderRunEnvelope<unknown>[];
  remainingBudget: ProviderBudget;
  attemptedSources: string[];
  unavailableSources: Array<{ providerKey: string; error: CapabilityError | null }>;
}

export async function executeSourcePortfolio(input: {
  plan: SourcePlan;
  authority: { workspaceId: string; discoveryBriefId: string };
  adapters: ReadonlyMap<string, SignalSourceAdapter>;
  selection: Omit<ProviderSelectionRequest, "capability" | "descriptors" | "allowFallback" | "budget">;
  budget: ProviderBudget;
  keywords: string[];
}): Promise<SourcePortfolioResult> {
  const plan = SourcePlanSchema.parse(input.plan);
  if (plan.workspaceId !== input.authority.workspaceId || plan.discoveryBriefId !== input.authority.discoveryBriefId) {
    throw new Error("Source plan does not match the authorized workspace and discovery brief");
  }
  if (plan.marketProfileId !== input.selection.profile.id) {
    throw new Error("Source plan does not match the authorized runtime market profile");
  }
  let budget = { ...input.budget };
  const signals: DiscoveredSignal[] = [];
  const providerRuns: ProviderRunEnvelope<unknown>[] = [];
  const attemptedSources: string[] = [];
  const unavailableSources: SourcePortfolioResult["unavailableSources"] = [];

  for (const source of plan.executable) {
    const adapter = input.adapters.get(source.providerKey);
    if (!adapter) {
      unavailableSources.push({ providerKey: source.providerKey, error: null });
      continue;
    }
    attemptedSources.push(source.providerKey);
    const execution = await executeProviderWithFallback<DiscoveredSignal[]>({
      ...input.selection,
      capability: "SOURCE_SEARCH",
      descriptors: [adapter.descriptor],
      budget,
      allowFallback: false,
    }, (_selection, context) => adapter.search({ keywords: input.keywords }, context));
    budget = execution.remainingBudget;
    if (execution.ok) {
      signals.push(...(execution.outcome.value ?? []));
      providerRuns.push(execution.outcome, ...(execution.outcome.relatedRuns ?? []));
    } else {
      if (execution.lastOutcome) providerRuns.push(execution.lastOutcome, ...(execution.lastOutcome.relatedRuns ?? []));
      unavailableSources.push({ providerKey: source.providerKey, error: execution.error });
    }
  }

  return {
    signals: deduplicate(signals),
    providerRuns: uniqueProviderRuns(providerRuns),
    remainingBudget: budget,
    attemptedSources,
    unavailableSources,
  };
}

function uniqueProviderRuns(runs: ProviderRunEnvelope<unknown>[]): ProviderRunEnvelope<unknown>[] {
  const unique = new Map<string, ProviderRunEnvelope<unknown>>();
  for (const run of runs) {
    const previous = unique.get(run.providerRunId);
    if (previous && (previous.provider !== run.provider || previous.providerVersion !== run.providerVersion)) {
      throw new Error("Source portfolio provider-run identity conflict");
    }
    unique.set(run.providerRunId, run);
  }
  return [...unique.values()];
}

function deduplicate(signals: DiscoveredSignal[]): DiscoveredSignal[] {
  const seen = new Set<string>();
  return signals.filter(signal => {
    const key = `${signal.source}:${signal.externalId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
