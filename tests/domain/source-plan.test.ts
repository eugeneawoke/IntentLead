import { describe, expect, it } from "vitest";
import { buildSourcePlan } from "../../lib/domain/source-plan";
import { DEFAULT_SOURCE_CATALOG } from "../../lib/domain/source-catalog";

const baseRequest = {
  schemaVersion: 1 as const,
  id: "source-plan-1",
  workspaceId: "workspace-1",
  discoveryBriefId: "brief-1",
  requestedConfirmedSignals: 20,
  maxProviders: 8,
  budget: { currency: "USD", maxCost: 0 },
  createdAt: "2026-10-06T12:00:00.000Z",
};

describe("SourcePlan v1", () => {
  it("selects a global SaaS portfolio instead of a single community", () => {
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT", "DETECTED_PROBLEM"],
    }, DEFAULT_SOURCE_CATALOG);

    expect(plan.status).toBe("PARTIAL");
    expect(plan.requestedConfirmedSignals).toBe(20);
    expect(plan.selected.map(item => item.providerKey)).toEqual(expect.arrayContaining([
      "official_company_site", "public_web_search", "reddit", "hackernews", "github", "stackexchange",
    ]));
    expect(new Set(plan.selected.map(item => item.sourceFamily)).size).toBeGreaterThan(2);
    expect(plan.executable.map(item => item.providerKey)).toEqual(["hackernews"]);
  });

  it("uses a regional portfolio for CIS instead of reusing the global tech plan", () => {
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId: "CIS_RU",
      languages: ["ru"],
      businessType: "AGENCY",
      signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT", "MARKET_OBSERVATION"],
    }, DEFAULT_SOURCE_CATALOG);

    expect(plan.selected.map(item => item.providerKey)).toEqual(expect.arrayContaining([
      "official_company_site", "yandex_search", "habr", "vc_ru",
    ]));
    expect(plan.selected.map(item => item.providerKey)).not.toContain("hackernews");
    expect(plan.status).toBe("BLOCKED");
    expect(plan.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerKey: "public_telegram", reason: "MANUAL_ONLY" }),
    ]));
  });

  it("selects maps, directories, reviews and official sites for local services", () => {
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId: "LOCAL_CUSTOM",
      languages: ["ru"],
      businessType: "LOCAL_SERVICE",
      signalFamilies: ["DETECTED_PROBLEM", "MARKET_OBSERVATION"],
    }, DEFAULT_SOURCE_CATALOG);

    expect(plan.selected.map(item => item.providerKey)).toEqual(expect.arrayContaining([
      "official_company_site", "yandex_maps", "two_gis", "regional_directories", "local_reviews",
    ]));
    expect(plan.selected.map(item => item.providerKey)).not.toContain("reddit");
  });

  it("keeps prohibited, unavailable, missing-credential and paid zero-budget sources out of execution", () => {
    const catalog = DEFAULT_SOURCE_CATALOG.map(item => {
      if (item.providerKey === "reddit") return { ...item, legalStatus: "PROHIBITED" as const };
      if (item.providerKey === "github") return { ...item, state: "MISSING_CREDENTIALS" as const };
      if (item.providerKey === "public_web_search") {
        return { ...item, state: "READY" as const, costClass: "PAID" as const, configuredCost: { amount: 0.1, currency: "USD" } };
      }
      return item;
    });
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "DETECTED_PROBLEM"],
    }, catalog);

    const executable = plan.executable.map(item => item.providerKey);
    expect(executable).not.toContain("reddit");
    expect(executable).not.toContain("github");
    expect(executable).not.toContain("public_web_search");
    expect(plan.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerKey: "reddit", reason: "PROHIBITED" }),
      expect.objectContaining({ providerKey: "github", reason: "MISSING_CREDENTIALS" }),
      expect.objectContaining({ providerKey: "public_web_search", reason: "BUDGET_EXCEEDED" }),
    ]));
  });

  it("orders zero-cost sources before paid sources when both are authorized", () => {
    const catalog = DEFAULT_SOURCE_CATALOG.map(item => item.providerKey === "public_web_search"
      ? { ...item, state: "READY" as const, costClass: "PAID" as const, configuredCost: { amount: 0.1, currency: "USD" } }
      : item);
    const plan = buildSourcePlan({
      ...baseRequest,
      budget: { currency: "USD", maxCost: 1 },
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "DETECTED_PROBLEM"],
    }, catalog);

    const costs = plan.executable.map(item => item.configuredCost.amount);
    const firstPaid = costs.findIndex(amount => amount > 0);
    expect(firstPaid).toBeGreaterThan(0);
    expect(costs.slice(0, firstPaid).every(amount => amount === 0)).toBe(true);
  });

  it("rejects a complete-run target below twenty", () => {
    expect(() => buildSourcePlan({ ...baseRequest, requestedConfirmedSignals: 5,
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT"],
    }, DEFAULT_SOURCE_CATALOG)).toThrow();
  });
});
