import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarketProfileSchema } from "../../lib/domain/schemas/market-profile";
import {
  createOfficialSiteContactProvider, type OfficialSiteEgress,
} from "../../worker/providers/official-site-contact";
import { requestText } from "../../worker/providers/http";
import type { ProviderRuntimeDependencies } from "../../worker/providers/contracts";
import { marketProfile } from "../domain/contract-fixtures";
import {
  fakeResponse, makeDependencies, providerDescriptor, providerRequest, runWithProviderReservation,
} from "./helpers";

const profile = MarketProfileSchema.parse({
  ...marketProfile,
  capabilities: ["SOURCE_SEARCH", "EMAIL_FIND", "HUMAN_REVIEW"],
});

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("global network access is forbidden"); })));
afterEach(() => vi.unstubAllGlobals());

function fixtureEgress(dependencies: ProviderRuntimeDependencies, authorizations: string[] = []): OfficialSiteEgress {
  return {
    fetchText({ sourceUrl, expectedRootDomain, init, signal }) {
      authorizations.push(`${expectedRootDomain}:${sourceUrl}`);
      return requestText(dependencies, sourceUrl, init, signal);
    },
  };
}

describe("official-site public business contact fallback", () => {
  it("returns only company role addresses with the exact official page URL", async () => {
    const calls: string[] = [];
    const { dependencies } = makeDependencies(async input => {
      calls.push(String(input));
      const page = String(input).endsWith("/contact")
        ? "<a href='mailto:hello@acme.com'>hello</a> sales@acme.com"
        : "Sales: sales@acme.com. Founder: alice@acme.com. External: support@other.com";
      return new Response(page, { status: 200, headers: { "content-type": "text/html" } });
    });
    const descriptor = providerDescriptor("official_company_site", "EMAIL_FIND");
    const authorizations: string[] = [];
    const adapter = createOfficialSiteContactProvider({
      descriptor, dependencies, egress: fixtureEgress(dependencies, authorizations),
    });
    const result = await runWithProviderReservation(providerRequest(profile, [descriptor], {
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
    }), (_selection, context) => adapter.findEmail({
      companyId: "company-1", companyDomain: "https://www.acme.com/path", evidenceIds: ["evidence-1"],
      scope: "COMPANY", personId: null, fullName: null, providerPersonId: null,
    }, context));

    expect(result.status).toBe("SUCCEEDED");
    expect(result.value?.map(candidate => candidate.value).sort()).toEqual(["hello@acme.com", "sales@acme.com"]);
    expect(JSON.stringify(result)).not.toContain("alice@acme.com");
    expect(JSON.stringify(result)).not.toContain("support@other.com");
    expect(result.value?.find(candidate => candidate.value === "hello@acme.com")?.source)
      .toEqual({ kind: "PUBLIC_WEB", url: "https://acme.com/contact", providerRunId: null });
    expect(result.provenance.map(item => item.sourceUrl)).toEqual(expect.arrayContaining([
      "https://acme.com/", "https://acme.com/contact",
    ]));
    expect(calls.every(url => new URL(url).hostname === "acme.com")).toBe(true);
    expect(authorizations.every(value => value.startsWith("acme.com:https://acme.com/"))).toBe(true);
  });

  it("treats absent conventional pages as an empty result instead of fabricating a contact", async () => {
    const { dependencies } = makeDependencies(async () => fakeResponse({ error: "not found" }, 404));
    const descriptor = providerDescriptor("official_company_site", "EMAIL_FIND");
    const adapter = createOfficialSiteContactProvider({ descriptor, dependencies, egress: fixtureEgress(dependencies) });
    const result = await runWithProviderReservation(providerRequest(profile, [descriptor], {
      budget: { currency: "USD", remainingCost: 0, remainingProviderCalls: 1 },
    }), (_selection, context) => adapter.findEmail({
      companyId: "company-1", companyDomain: "acme.com", evidenceIds: ["evidence-1"],
      scope: "COMPANY", personId: null, fullName: null, providerPersonId: null,
    }, context));
    expect(result).toMatchObject({ status: "EMPTY", value: [], provenance: [] });
  });

  it("does not use company-page discovery as a person-email lookup", async () => {
    let calls = 0;
    const { dependencies } = makeDependencies(async () => { calls++; return fakeResponse({}); });
    const descriptor = providerDescriptor("official_company_site", "EMAIL_FIND");
    const adapter = createOfficialSiteContactProvider({ descriptor, dependencies, egress: fixtureEgress(dependencies) });
    const result = await runWithProviderReservation(providerRequest(profile, [descriptor]), (_selection, context) =>
      adapter.findEmail({
        companyId: "company-1", companyDomain: "acme.com", evidenceIds: ["evidence-1"], scope: "PERSON",
        personId: "person-1", fullName: "Alice Example", providerPersonId: null,
      }, context));
    expect(result).toMatchObject({ status: "EMPTY", value: [] });
    expect(calls).toBe(0);
  });

  it("fails closed without an authority-owning egress dependency", () => {
    const { dependencies } = makeDependencies(async () => { throw new Error("must not run"); });
    const descriptor = providerDescriptor("official_company_site", "EMAIL_FIND");
    const incomplete = { descriptor, dependencies } as Parameters<typeof createOfficialSiteContactProvider>[0];

    expect(() => createOfficialSiteContactProvider(incomplete))
      .toThrow("requires an authorized egress dependency");
  });

  it("propagates an egress authority denial without falling back to the raw HTTP dependency", async () => {
    let rawHttpCalls = 0;
    const { dependencies } = makeDependencies(async () => { rawHttpCalls++; return fakeResponse({}); });
    const descriptor = providerDescriptor("official_company_site", "EMAIL_FIND");
    const adapter = createOfficialSiteContactProvider({
      descriptor,
      dependencies,
      egress: { async fetchText() { throw new Error("egress denied"); } },
    });
    const result = await runWithProviderReservation(providerRequest(profile, [descriptor]), (_selection, context) =>
      adapter.findEmail({
        companyId: "company-1", companyDomain: "acme.com", evidenceIds: ["evidence-1"], scope: "COMPANY",
        personId: null, fullName: null, providerPersonId: null,
      }, context));

    expect(result).toMatchObject({ status: "FAILED", failureKind: "UNAVAILABLE", value: null });
    expect(rawHttpCalls).toBe(0);
  });
});
