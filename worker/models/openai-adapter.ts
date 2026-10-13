import type { Response, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import type { ModelAdapter, ModelAdapterRequest, ModelCallContext } from "../../types/model-runtime";
import type { ModelProviderDescriptor } from "../../types/model-provider";
import { consumeModelReservation } from "./registry";
import { ModelAdapterFailure, type ModelAdapterFailureCode } from "./model-adapter-failure";

export interface OpenAIResponsesClient {
  responses: {
    create(
      body: ResponseCreateParamsNonStreaming,
      options: { signal: AbortSignal; maxRetries: 0 },
    ): Promise<Response>;
  };
}

export interface OpenAIModelCompatibility {
  model: string;
  structuredOutputs: "verified";
}

function refusalPresent(response: Response): boolean {
  return response.output.some(item => item.type === "message"
    && item.content.some(content => content.type === "refusal"));
}

function rejectResponse(response: Response, message: string, code: ModelAdapterFailureCode): never {
  const usage = response.usage;
  const validUsage = usage
    && Number.isInteger(usage.input_tokens) && usage.input_tokens >= 0
    && Number.isInteger(usage.output_tokens) && usage.output_tokens >= 0;
  throw new ModelAdapterFailure(message, code, {
    providerResponseId: response.id,
    reportedModel: response.model,
    inputTokens: validUsage ? usage.input_tokens : undefined,
    outputTokens: validUsage ? usage.output_tokens : undefined,
  });
}

function parseCompletedResponse(response: Response, expectedModel: string) {
  if (response.status !== "completed" || response.error || response.incomplete_details) {
    rejectResponse(response, "OpenAI response did not complete", "CAPABILITY_UNAVAILABLE");
  }
  if (refusalPresent(response)) rejectResponse(response, "OpenAI response was refused", "POLICY_DENIED");
  if (response.model !== expectedModel) {
    rejectResponse(response, "OpenAI response model does not match the authorized model", "POLICY_DENIED");
  }
  if (!response.usage
    || !Number.isInteger(response.usage.input_tokens) || response.usage.input_tokens < 0
    || !Number.isInteger(response.usage.output_tokens) || response.usage.output_tokens < 0) {
    rejectResponse(response, "OpenAI response usage is missing or invalid", "MALFORMED_RESPONSE");
  }
  if (!response.output_text.trim()) rejectResponse(response, "OpenAI response output is empty", "MALFORMED_RESPONSE");
  let output: unknown;
  try {
    output = JSON.parse(response.output_text);
  } catch {
    rejectResponse(response, "OpenAI response is not valid JSON", "MALFORMED_RESPONSE");
  }
  return {
    output,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    limitations: [] as string[],
    providerResponseId: response.id,
    reportedModel: response.model,
  };
}

async function requestOpenAIStructuredResponse(
  client: OpenAIResponsesClient,
  descriptor: ModelProviderDescriptor,
  request: ModelAdapterRequest,
  context: ModelCallContext,
) {
  const response = await client.responses.create({
    model: descriptor.model,
    instructions: request.messages[0].content,
    input: [{ role: "user", content: request.messages[1].content }],
    max_output_tokens: request.maxOutputTokens,
    background: false,
    store: false,
    truncation: "disabled",
    text: {
      format: {
        type: "json_schema",
        name: request.structuredOutput.name,
        schema: { ...request.structuredOutput.schema },
        strict: true,
      },
    },
  }, {
    signal: context.signal,
    maxRetries: 0,
  });
  return parseCompletedResponse(response, descriptor.model);
}

export function createOpenAIResponsesAdapter(
  client: OpenAIResponsesClient,
  descriptor: ModelProviderDescriptor,
  compatibility: OpenAIModelCompatibility,
): ModelAdapter {
  if (descriptor.id !== "openai") throw new Error("OpenAI adapter requires an OpenAI descriptor");
  if (compatibility.structuredOutputs !== "verified" || compatibility.model !== descriptor.model) {
    throw new Error("OpenAI adapter requires verified Structured Outputs compatibility for the exact model");
  }
  return Object.freeze({
    descriptor,
    async complete(request: ModelAdapterRequest, context: ModelCallContext) {
      consumeModelReservation(descriptor, context.capability, context);
      return requestOpenAIStructuredResponse(client, descriptor, request, context);
    },
  });
}
