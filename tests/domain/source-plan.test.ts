import { describe, expect, it } from "vitest";
import { buildSourcePlan } from "../../lib/domain/source-plan";
import { DEFAULT_SOURCE_CATALOG } from "../../lib/domain/source-catalog";
import { SourcePlanSchema } from "../../lib/domain/schemas/source-plan";

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
      maxProviders: 20,
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "BUSINESS_EVENT", "DETECTED_PROBLEM"],
    }, DEFAULT_SOURCE_CATALOG);

    expect(plan.status).toBe("BLOCKED");
    expect(plan.requestedConfirmedSignals).toBe(20);
    expect(plan.selected.map(item => item.providerKey)).toEqual(expect.arrayContaining([
      "official_company_site", "public_web_search", "reddit", "hackernews", "github", "stackexchange",
    ]));
    expect(new Set(plan.selected.map(item => item.sourceFamily)).size).toBeGreaterThan(2);
    expect(plan.executable).toEqual([]);
  });

  it("uses a regional portfolio for CIS instead of reusing the global tech plan", () => {
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId: "CIS",
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
      expect.objectContaining({ providerKey: "public_telegram", reason: "LEGAL_RESTRICTED" }),
    ]));
  });

  it.each([
    ["GLOBAL_EN", "en"], ["CIS", "ru"], ["RU", "ru"], ["BY", "ru"], ["KZ", "ru"],
  ] as const)("builds an explicit %s planning foundation", (marketProfileId, language) => {
    const plan = buildSourcePlan({
      ...baseRequest,
      marketProfileId,
      languages: [language],
      businessType: "SAAS",
      signalFamilies: ["BUSINESS_EVENT", "DETECTED_PROBLEM"],
    }, DEFAULT_SOURCE_CATALOG);
    expect(plan.selected.length).toBeGreaterThan(0);
    expect(plan.marketProfileId).toBe(marketProfileId);
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

  it("keeps prohibited, unavailable, missing-credential and paid-locked sources out of execution", () => {
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
      maxProviders: 20,
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

  it("keeps demand-gated paid search providers locked even when the budget could cover them", () => {
    const paidCatalog = DEFAULT_SOURCE_CATALOG.filter(item => item.providerKey === "exa" || item.providerKey === "serper");
    const plan = buildSourcePlan({
      ...baseRequest,
      budget: { currency: "USD", maxCost: 10 },
      maxProviders: 2,
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT"],
    }, paidCatalog);

    expect(plan.status).toBe("BLOCKED");
    expect(plan.executable).toEqual([]);
    expect(plan.gaps).toEqual([
      { providerKey: "exa", reason: "PAID_LOCKED" },
      { providerKey: "serper", reason: "PAID_LOCKED" },
    ]);
  });

  it("orders zero-cost sources before paid sources when both are authorized", () => {
    const catalog = DEFAULT_SOURCE_CATALOG.map(item => {
      if (item.providerKey === "public_web_search") {
        return { ...item, state: "READY" as const, costClass: "PAID" as const, configuredCost: { amount: 0.1, currency: "USD" } };
      }
      if (item.providerKey === "hackernews") return { ...item, state: "READY" as const };
      return item;
    });
    const plan = buildSourcePlan({
      ...baseRequest,
      maxProviders: 20,
      budget: { currency: "USD", maxCost: 1 },
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "DETECTED_PROBLEM"],
    }, catalog);

    const costs = plan.executable.map(item => item.configuredCost.amount);
    const firstPaid = costs.findIndex(amount => amount !== null && amount > 0);
    expect(firstPaid).toBeGreaterThan(0);
    expect(costs.slice(0, firstPaid).every(amount => amount === 0)).toBe(true);
  });

  it("keeps cumulative executable source cost within the plan budget", () => {
    const catalog = DEFAULT_SOURCE_CATALOG
      .filter(item => item.providerKey === "public_web_search" || item.providerKey === "github")
      .map(item => ({
        ...item,
        state: "READY" as const,
        costClass: "PAID" as const,
        configuredCost: { amount: 0.6, currency: "USD" },
      }));
    const plan = buildSourcePlan({
      ...baseRequest,
      budget: { currency: "USD", maxCost: 1 },
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT"],
    }, catalog);
    expect(plan.executable).toHaveLength(1);
    expect(plan.gaps).toEqual([expect.objectContaining({ reason: "BUDGET_EXCEEDED" })]);
  });

  it("does not let an incompatible-currency source displace an executable source", () => {
    const catalog = DEFAULT_SOURCE_CATALOG
      .filter(item => item.providerKey === "github" || item.providerKey === "hackernews")
      .map(item => ({
        ...item, state: "READY" as const, costClass: "PAID" as const,
        configuredCost: item.providerKey === "github"
          ? { amount: 0, currency: "EUR" }
          : { amount: 1, currency: "USD" },
      }));
    const plan = buildSourcePlan({
      ...baseRequest, budget: { currency: "USD", maxCost: 1 }, maxProviders: 1,
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["DETECTED_PROBLEM"],
    }, catalog);

    expect(plan.executable.map(item => item.providerKey)).toEqual(["hackernews"]);
    expect(plan.status).toBe("PARTIAL");
  });

  it("rejects a complete-run target below twenty", () => {
    expect(() => buildSourcePlan({ ...baseRequest, requestedConfirmedSignals: 5,
      marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT"],
    }, DEFAULT_SOURCE_CATALOG)).toThrow();
  });

  it("does not let a planned high-priority source displace an executable source", () => {
    const catalog = DEFAULT_SOURCE_CATALOG.map(item => item.providerKey === "hackernews"
      ? { ...item, state: "READY" as const }
      : item);
    const plan = buildSourcePlan({
      ...baseRequest,
      maxProviders: 1,
      marketProfileId: "EN_DISCOVERY_ONLY",
      languages: ["en"],
      businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT"],
    }, catalog);
    expect(plan.executable.map(item => item.providerKey)).toEqual(["hackernews"]);
  });

  it("never executes a legally restricted source even when it is operational", () => {
    const restricted = DEFAULT_SOURCE_CATALOG.filter(item => item.providerKey === "product_hunt")
      .map(item => ({ ...item, state: "READY" as const }));
    const plan = buildSourcePlan({
      ...baseRequest, marketProfileId: "GLOBAL_EN", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["BUSINESS_EVENT"], maxProviders: 1,
    }, restricted);
    expect(plan.executable).toEqual([]);
    expect(plan.gaps).toEqual([{ providerKey: "product_hunt", reason: "LEGAL_RESTRICTED" }]);
  });

  it("uses explicit expected value after availability and cost", () => {
    const catalog = DEFAULT_SOURCE_CATALOG.filter(item => ["github", "hackernews"].includes(item.providerKey))
      .map(item => ({ ...item, state: "READY" as const, priority: 10,
        expectedValueScore: item.providerKey === "github" ? 0.9 : 0.2 }));
    const plan = buildSourcePlan({
      ...baseRequest, marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["DETECTED_PROBLEM"], maxProviders: 2,
    }, catalog);
    expect(plan.executable.map(item => item.providerKey)).toEqual(["github", "hackernews"]);
  });

  it("rejects an executable snapshot or status that diverges from the selected portfolio", () => {
    const catalog = DEFAULT_SOURCE_CATALOG
      .filter(item => ["github", "hackernews", "stackexchange"].includes(item.providerKey))
      .map(item => ({ ...item, state: "READY" as const }));
    const plan = buildSourcePlan({
      ...baseRequest, marketProfileId: "EN_DISCOVERY_ONLY", languages: ["en"], businessType: "SAAS",
      signalFamilies: ["EXPRESSED_INTENT", "DETECTED_PROBLEM"], maxProviders: 3,
    }, catalog);
    const executable = plan.executable.map((source, index) => index === 0
      ? { ...source, accessMode: "PUBLIC_WEB" as const }
      : source);

    expect(SourcePlanSchema.safeParse({ ...plan, executable }).success).toBe(false);
    expect(SourcePlanSchema.safeParse({ ...plan, status: "BLOCKED" }).success).toBe(false);
    expect(SourcePlanSchema.safeParse({
      ...plan,
      executable: plan.executable.map((source, index) => index === 0
        ? { ...source, configuredCost: { amount: null, currency: null } }
        : source),
    }).success).toBe(false);
    expect(SourcePlanSchema.safeParse({
      ...plan,
      executable: plan.executable.slice(1),
      gaps: [{ providerKey: plan.executable[0]!.providerKey, reason: "PROHIBITED" }, ...plan.gaps],
    }).success).toBe(false);
  });
});
