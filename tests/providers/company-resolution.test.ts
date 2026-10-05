import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import { marketProfile } from "../domain/contract-fixtures";
import { createExaCompanyResolutionProvider, createSerperCompanyResolutionProvider } from "../../worker/providers/company-resolution";
import type { CompanyInference, ProviderCallContext } from "../../worker/providers/contracts";
import { fakeResponse, makeDependencies, providerDescriptor } from "./helpers";

const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "HUMAN_REVIEW"],
});
const context: ProviderCallContext = { profile, traceId: "company-fixture", signal: new AbortController().signal };

function buildProvider(key: "exa" | "serper", body: unknown, inference: CompanyInference) {
  const { dependencies } = makeDependencies(async () => fakeResponse(body));
  const config = { apiKey: "fixture-key", descriptor: providerDescriptor(key, "COMPANY_RESOLUTION"), dependencies, inference };
  return key === "exa" ? createExaCompanyResolutionProvider(config) : createSerperCompanyResolutionProvider(config);
}

function evidenceIds(input: Parameters<CompanyInference["infer"]>[0]): string[] {
  return (JSON.parse(input.messages[1].content) as { evidence: Array<{ providerSourceId: string }> })
    .evidence.map(item => item.providerSourceId);
}

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden in provider tests"); })));
afterEach(() => vi.unstubAllGlobals());

describe("company resolution", () => {
  it.each(["exa", "serper"] as const)("returns evidence-backed normalized candidates from %s", async key => {
    const body = fixture(key === "exa" ? "exa-success.json" : "serper-success.json");
    let inferenceInput: Parameters<CompanyInference["infer"]>[0] | undefined;
    const provider = buildProvider(key, body, { async infer(input) {
      inferenceInput = input;
      return { candidates: [{
        companyName: "Acme Example",
        companyDomain: "https://www.acme.test/company/page",
        confidence: 0.91,
        evidenceSourceIds: [evidenceIds(input)[0]],
      }] };
    } });
    const result = await provider.resolve({ signalContent: "Fictional Acme Example public workflow issue" }, context);

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value?.[0]).toMatchObject({
      companyName: "Acme Example",
      companyDomain: "acme.test",
      confidence: 0.91,
      resolutionStatus: "RESOLVED",
      evidence: [{ providerId: key, sourceUrl: expect.stringContaining("acme.test") }],
    });
    expect(inferenceInput?.messages.map(message => message.role)).toEqual(["system", "user"]);
    expect(inferenceInput?.messages[0].content).toContain("Do not identify or enrich a person");
    expect(inferenceInput?.messages[1].content).not.toContain("synthetic_");
  });

  it("keeps ambiguous low-confidence company hypotheses explicit", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), { async infer(input) {
      const ids = evidenceIds(input);
      return { candidates: [
        { companyName: "Acme Example", companyDomain: "acme.test", confidence: 0.58, evidenceSourceIds: [ids[0]] },
        { companyName: "Acme Example Studio", companyDomain: "www.acme.test", confidence: 0.62, evidenceSourceIds: [ids[1]] },
      ] };
    } });
    const result = await provider.resolve({ signalContent: "Fictional public signal" }, context);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.value).toHaveLength(2);
    expect(result.value?.every(candidate => candidate.resolutionStatus === "AMBIGUOUS")).toBe(true);
  });

  it("rejects malformed inference output", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), { async infer() { return { candidates: "drift" }; } });
    const result = await provider.resolve({ signalContent: "Fictional public signal" }, context);
    expect(result.status).toBe("FAILED");
    expect(result.failureKind).toBe("MALFORMED_RESPONSE");
    expect(result.value).toBeNull();
  });

  it("downgrades an invalid root domain to an uncertain company name", async () => {
    const provider = buildProvider("exa", fixture("exa-success.json"), { async infer(input) {
      return { candidates: [{
        companyName: "Acme Example",
        companyDomain: "localhost",
        confidence: 0.99,
        evidenceSourceIds: [evidenceIds(input)[0]],
      }] };
    } });
    const result = await provider.resolve({ signalContent: "Fictional public signal" }, context);
    expect(result.status).toBe("SUCCEEDED");
    expect(result.value?.[0]).toMatchObject({ companyName: "Acme Example", companyDomain: null, resolutionStatus: "UNCERTAIN" });
  });

  it("rejects unknown evidence and unsupported factual fields", async () => {
    const cases: Array<(id: string) => unknown> = [
      () => ({ candidates: [{ companyName: "Acme Example", companyDomain: "acme.test", confidence: 0.99, evidenceSourceIds: ["other-source"] }] }),
      id => ({ candidates: [{ companyName: "Acme Example", companyDomain: "acme.test", confidence: 0.99, email: "person@example.test", evidenceSourceIds: [id] }] }),
    ];
    for (const output of cases) {
      const provider = buildProvider("exa", fixture("exa-success.json"), { async infer(input) { return output(evidenceIds(input)[0]); } });
      const result = await provider.resolve({ signalContent: "Fictional public signal" }, context);
      expect(result.status).toBe("FAILED");
      expect(result.failureKind).toBe("MALFORMED_RESPONSE");
      expect(result.value).toBeNull();
    }
  });
});
