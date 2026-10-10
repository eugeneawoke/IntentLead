import type { Response, ResponseCreateParamsNonStreaming } from "openai/resources/responses/responses";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ModelAdapterRequest, ModelCallContext, ModelReservation } from "../../types/model-runtime";
import type { ModelProviderDescriptor } from "../../types/model-provider";

vi.mock("../../worker/models/registry", () => ({
  consumeModelReservation: vi.fn(),
}));

import { consumeModelReservation } from "../../worker/models/registry";
import {
  createOpenAIResponsesAdapter,
  type OpenAIResponsesClient,
} from "../../worker/models/openai-adapter";
import { createOpenAIResponsesClient } from "../../worker/models/openai-client";
import { ModelAdapterFailure, type ModelAdapterFailureCode } from "../../worker/models/model-adapter-failure";

const descriptor: ModelProviderDescriptor = {
  id: "openai",
  model: "founder-selected-model",
  version: "responses-v1",
  capabilities: ["STRUCTURE_DISCOVERY_BRIEF"],
  operationalState: "paid_locked",
  maxInputTokens: 8_000,
  configuredCostPerMillionInputTokens: null,
  configuredCostPerMillionOutputTokens: null,
  configuredCostCurrency: null,
};
const compatibility = { model: descriptor.model, structuredOutputs: "verified" } as const;

const request: ModelAdapterRequest = {
  messages: [
    { role: "system", content: "Fixed system instruction" },
    { role: "user", content: "Untrusted user payload" },
  ],
  maxInputTokens: 4_000,
  maxOutputTokens: 800,
  structuredOutput: {
    name: "intentlead_test_output",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer"],
      properties: { answer: { type: "string" } },
    },
  },
};

function context(): ModelCallContext {
  return {
    signal: new AbortController().signal,
    reservation: Object.freeze({}) as ModelReservation,
    requestFingerprint: "a".repeat(64),
    traceId: "trace-1",
    capability: "STRUCTURE_DISCOVERY_BRIEF",
  };
}

function response(overrides: Partial<Response> = {}): Response {
  return {
    id: "resp-1",
    object: "response",
    created_at: 0,
    model: descriptor.model,
    status: "completed",
    error: null,
    incomplete_details: null,
    output_text: JSON.stringify({ answer: "ok" }),
    output: [],
    usage: {
      input_tokens: 12,
      output_tokens: 5,
      total_tokens: 17,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
    ...overrides,
  } as Response;
}

function client(result: Response) {
  const create = vi.fn(async (
    _body: ResponseCreateParamsNonStreaming,
    _options: { signal: AbortSignal; maxRetries: 0 },
  ) => {
    void _body;
    void _options;
    return result;
  });
  return { value: { responses: { create } } as OpenAIResponsesClient, create };
}

describe("OpenAI Responses adapter", () => {
  beforeEach(() => vi.mocked(consumeModelReservation).mockClear());

  it("sends only separated instructions/input with strict structured output", async () => {
    const fake = client(response());
    const callContext = context();
    const result = await createOpenAIResponsesAdapter(fake.value, descriptor, compatibility).complete(request, callContext);

    expect(consumeModelReservation).toHaveBeenCalledOnce();
    expect(consumeModelReservation).toHaveBeenCalledWith(descriptor, "STRUCTURE_DISCOVERY_BRIEF", callContext);
    expect(fake.create).toHaveBeenCalledOnce();
    const [body, options] = fake.create.mock.calls[0]!;
    expect(body).toMatchObject({
      model: descriptor.model,
      instructions: "Fixed system instruction",
      input: [{ role: "user", content: "Untrusted user payload" }],
      max_output_tokens: 800,
      background: false,
      store: false,
      truncation: "disabled",
      text: { format: { type: "json_schema", name: "intentlead_test_output", strict: true } },
    });
    expect(body).not.toHaveProperty("tools");
    expect(body).not.toHaveProperty("tool_choice");
    expect(options).toEqual({ signal: callContext.signal, maxRetries: 0 });
    expect(result).toEqual({
      output: { answer: "ok" }, inputTokens: 12, outputTokens: 5, limitations: [],
      providerResponseId: "resp-1", reportedModel: descriptor.model,
    });
  });

  it.each([
    ["refusal", "POLICY_DENIED", response({ output: [{ type: "message", id: "msg-1", role: "assistant", status: "completed", content: [{ type: "refusal", refusal: "no" }] }] })],
    ["incomplete", "CAPABILITY_UNAVAILABLE", response({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" } })],
    ["failed status", "CAPABILITY_UNAVAILABLE", response({ status: "failed", error: { code: "server_error", message: "provider failure" } })],
    ["model mismatch", "POLICY_DENIED", response({ model: "unexpected-model" })],
    ["missing usage", "MALFORMED_RESPONSE", response({ usage: undefined })],
    ["empty output", "MALFORMED_RESPONSE", response({ output_text: " " })],
    ["malformed JSON", "MALFORMED_RESPONSE", response({ output_text: "not-json" })],
  ] satisfies Array<[string, ModelAdapterFailureCode, Response]>)("fails closed on %s with provider provenance", async (_case, code, providerResponse) => {
    const fake = client(providerResponse);
    const failure = await createOpenAIResponsesAdapter(fake.value, descriptor, compatibility).complete(request, context())
      .then(() => null, error => error);
    expect(failure).toBeInstanceOf(ModelAdapterFailure);
    expect(failure).toMatchObject({
      code,
      providerResponseId: providerResponse.id,
      reportedModel: providerResponse.model,
    });
    if (providerResponse.usage) {
      expect(failure).toMatchObject({
        inputTokens: providerResponse.usage.input_tokens,
        outputTokens: providerResponse.usage.output_tokens,
      });
    } else {
      expect(failure).toMatchObject({ inputTokens: undefined, outputTokens: undefined });
    }
  });

  it("rejects a descriptor for another provider before constructing an adapter", () => {
    const fake = client(response());
    expect(() => createOpenAIResponsesAdapter(fake.value, { ...descriptor, id: "anthropic" }, compatibility)).toThrow();
    expect(() => createOpenAIResponsesAdapter(fake.value, descriptor, { ...compatibility, model: "other-model" })).toThrow();
    expect(fake.create).not.toHaveBeenCalled();
  });

  it("requires an explicit credential when constructing the real SDK client", () => {
    expect(() => createOpenAIResponsesClient(" ")).toThrow("OpenAI API key is required");
    expect(createOpenAIResponsesClient("test-only-key").responses.create).toBeTypeOf("function");
  });
});
