import type { ModelProviderDescriptor } from "../../types/model-provider";

const capabilities: ModelProviderDescriptor["capabilities"] = [
  "STRUCTURE_DISCOVERY_BRIEF", "PROPOSE_SOURCE_PLAN", "INTERPRET_EVIDENCE",
  "ASSESS_OPPORTUNITY", "RANK_BUYERS", "DRAFT_GROUNDED_COPY",
];

function descriptor(value: ModelProviderDescriptor): ModelProviderDescriptor {
  return Object.freeze({ ...value, capabilities: Object.freeze([...value.capabilities]) }) as ModelProviderDescriptor;
}

export const MODEL_PROVIDER_CATALOG: readonly ModelProviderDescriptor[] = Object.freeze([
  descriptor({ id: "openai", model: "configured-later", version: "v1", capabilities, operationalState: "paid_locked", maxInputTokens: 128_000, configuredCostPerMillionInputTokens: null, configuredCostPerMillionOutputTokens: null, configuredCostCurrency: null }),
  descriptor({ id: "anthropic", model: "configured-later", version: "v1", capabilities, operationalState: "paid_locked", maxInputTokens: 200_000, configuredCostPerMillionInputTokens: null, configuredCostPerMillionOutputTokens: null, configuredCostCurrency: null }),
  descriptor({ id: "gemini", model: "configured-later", version: "v1", capabilities, operationalState: "paid_locked", maxInputTokens: 128_000, configuredCostPerMillionInputTokens: null, configuredCostPerMillionOutputTokens: null, configuredCostCurrency: null }),
  descriptor({ id: "local", model: "configured-later", version: "v1", capabilities, operationalState: "planned", maxInputTokens: 32_000, configuredCostPerMillionInputTokens: 0, configuredCostPerMillionOutputTokens: 0, configuredCostCurrency: null }),
]);
