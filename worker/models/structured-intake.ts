import {
  StructureDiscoveryIntakePortResultSchema,
} from "../../lib/domain/schemas/conversational-intake";
import type {
  StructureDiscoveryIntakePort,
} from "../../types/conversational-intake";
import type { ModelAdapter } from "../../types/model-runtime";
import { sha256 } from "../providers/normalization";
import { executeModel } from "./registry";
import { STRUCTURED_DISCOVERY_INTAKE_OUTPUT } from "./structured-output-schemas";

const ModelStructuredIntakeOutputSchema = StructureDiscoveryIntakePortResultSchema.pick({
  schemaVersion: true,
  intake: true,
  fieldSupports: true,
});

export function createStructuredDiscoveryIntakePort(adapter: ModelAdapter): StructureDiscoveryIntakePort {
  return {
    async structure(input) {
      const result = await executeModel({
        executionMode: "fixture",
        providerId: "local",
        policy: {
          capability: "STRUCTURE_DISCOVERY_BRIEF",
          evidenceIds: [],
          budget: {
            currency: "USD", remainingCost: 0,
            remainingInputTokens: 32_000, remainingOutputTokens: 1_200, remainingCalls: 1,
          },
          allowExternalActions: false,
          allowProviderSelection: false,
          sourceContentRole: "UNTRUSTED_DATA",
        },
        input: { userTurns: input.userTurns },
        sourceContent: [],
        timeoutMs: 5_000,
        maxInputTokens: 32_000,
        maxOutputTokens: 1_200,
        evidenceExists: () => false,
        outputSchema: ModelStructuredIntakeOutputSchema,
        structuredOutput: STRUCTURED_DISCOVERY_INTAKE_OUTPUT,
        traceId: `intake:${sha256(JSON.stringify(input))}`,
      }, adapter);
      if (!result.ok) throw new Error(`Structured intake failed: ${result.code}`);
      return StructureDiscoveryIntakePortResultSchema.parse({
        ...result.run.output,
        telemetry: {
          model: result.run.model,
          modelVersion: result.run.providerVersion,
          inputTokens: result.run.inputTokens,
          outputTokens: result.run.outputTokens,
          latencyMs: result.run.latencyMs,
          cost: result.run.cost,
          limitations: result.run.limitations,
        },
        prompt: {
          templateId: result.run.promptId,
          version: result.run.promptVersion,
          systemInstructionHash: result.run.promptSystemHash,
          userContentRole: "UNTRUSTED_USER",
        },
      });
    },
  };
}
