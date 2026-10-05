import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { createExaCompanyResolutionProvider, createSerperCompanyResolutionProvider } from "../../worker/providers/company-resolution";
import { COMPANY_INFERENCE_SYSTEM_INSTRUCTION, createCompanyInferenceAdapter } from "../../worker/providers/inference";
import type { CompanyInferenceInput } from "../../worker/providers/contracts";
import { fakeResponse, makeDependencies, providerDescriptor, providerRequest, runWithProviderReservation } from "./helpers";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});
const inferenceDescriptor = providerDescriptor("openai", "COMPANY_RESOLUTION");

type InferFixture = (input: CompanyInferenceInput) => Promise<unknown>;

function buildProvider(key: "exa" | "serper", body: unknown, infer: InferFixture) {
  const { dependencies } = makeDependencies(async () => fakeResponse(body));
  const inferenceProvider = createCompanyInferenceAdapter({
    descriptor: inferenceDescriptor,
    dependencies,
    async complete(input) { return { content: await infer(input), inputTokens: null, outputTokens: null }; },
  });
  const config = { apiKey: "fixture-key", descriptor: providerDescriptor(key, "COMPANY_RESOLUTION"), dependencies, inferenceProvider };
  return key === "exa" ? createExaCompanyResolutionProvider(config) : createSerperCompanyResolutionProvider(config);
}

function evidenceIds(input: CompanyInferenceInput): string[] {
  return (JSON.parse(input.messages[1].content) as { evidence: Array<{ providerSourceId: string }> })
    .evidence.map(item => item.providerSourceId);
}

function resolveRegistered(provider: ReturnType<typeof buildProvider>, signalContent: string) {
  return runWithProviderReservation(providerRequest(profile, [provider.descriptor], {
    traceId: "company-fixture",
    nestedDescriptors: [inferenceDescriptor],
    budget: { currency: "USD", remainingCost: 1, remainingProviderCalls: 2 },
  }), (_selected, context) => provider.resolve({ signalContent }, context));
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("company resolution", () => {
  it.each(["exa", "serper"] as const)("returns evidence-backed normalized candidates from %s", async key => {
    const body = fixture(key === "exa" ? "exa-success.json" : "serper-success.json");
    let inferenceInput: CompanyInferenceInput | undefined;
    const provider = buildProvider(key, body, async input => {
      inferenceInput = input;
      return { candidates: [{
        companyName: "Acme Example",
        companyDomain: "https://www.acme.example.com/company/page",
        confidence: 0.91,
        evidenceSourceIds: [evidenceIds(input)[0]],
      }] };
    });
    const result = await resolveRegistered(provider, "Fictional Acme Example public workflow issue");

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value?.[0]).toMatchObject({
      companyName: "Acme Example",
      companyDomain: "example.com",
      confidence: 0.91,
      resolutionStatus: "RESOLVED",
      evidence: [{ providerId: key, sourceUrl: expect.stringContaining("acme.example.com") }],
    });
    expect(inferenceInput?.messages.map(message => message.role)).toEqual(["system", "user"]);
    expect(inferenceInput?.messages[0].content).toBe(COMPANY_INFERENCE_SYSTEM_INSTRUCTION);
    expect(inferenceInput?.messages[1].content).not.toContain("synthetic_");
  });

  it("keeps ambiguous low-confidence company hypotheses explicit", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), async input => {
      const ids = evidenceIds(input);
      return { candidates: [
        { companyName: "Acme Example", companyDomain: "example.com", confidence: 0.58, evidenceSourceIds: [ids[0]] },
        { companyName: "Acme Example Studio", companyDomain: "www.acme.example.com", confidence: 0.62, evidenceSourceIds: [ids[1]] },
      ] };
    });
    const result = await resolveRegistered(provider, "Fictional public signal");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(2);
    expect(result.value?.every(candidate => candidate.resolutionStatus === "AMBIGUOUS")).toBe(true);
  });

  it("rejects malformed inference output", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), async () => ({ candidates: "drift" }));
    const result = await resolveRegistered(provider, "Fictional public signal");
    expect(result.status).toBe("PARTIAL");
    expect(result.failureKind).toBe("MALFORMED_RESPONSE");
    expect(result.value).toEqual([]);
    expect(result.relatedRuns?.[0]).toMatchObject({ status: "FAILED", failureKind: "MALFORMED_RESPONSE" });
  });

  it("downgrades an invalid root domain to an uncertain company name", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), async input => {
      return { candidates: [{
        companyName: "Acme Example",
        companyDomain: "co.il",
        confidence: 0.99,
        evidenceSourceIds: [evidenceIds(input)[0]],
      }] };
    });
    const result = await resolveRegistered(provider, "Fictional public signal");
    expect(result.status).toBe("SUCCEEDED");
    expect(result.value?.[0]).toMatchObject({ companyName: "Acme Example", companyDomain: null, resolutionStatus: "UNCERTAIN" });
  });

  it("rejects unknown evidence and unsupported factual fields", async () => {
    const cases: Array<(id: string) => unknown> = [
      () => ({ candidates: [{ companyName: "Acme Example", companyDomain: "example.com", confidence: 0.99, evidenceSourceIds: ["other-source"] }] }),
      id => ({ candidates: [{ companyName: "Acme Example", companyDomain: "example.com", confidence: 0.99, email: "person@example.test", evidenceSourceIds: [id] }] }),
    ];
    for (const output of cases) {
      const provider = buildProvider("exa", fixture("exa-success.json"), async input => output(evidenceIds(input)[0]));
      const result = await resolveRegistered(provider, "Fictional public signal");
      expect(result.status).toBe("PARTIAL");
      expect(result.failureKind).toBe("MALFORMED_RESPONSE");
      expect(result.value).toEqual([]);
    }
  });
});
