import { expect, test, type Page } from "@playwright/test";

const ids = {
  brief: "10000000-0000-4000-8000-000000000001",
  workspace: "10000000-0000-4000-8000-000000000002",
  offer: "10000000-0000-4000-8000-000000000003",
  icp: "10000000-0000-4000-8000-000000000004",
  market: "10000000-0000-4000-8000-000000000005",
  job: "10000000-0000-4000-8000-000000000006",
};
const now = "2026-10-06T08:00:00.000Z";

async function installApi(page: Page) {
  let brief: Record<string, unknown> | null = null;
  let generated = false;
  let reviewed = false;
  const opportunityId = "10000000-0000-4000-8000-000000000007";
  const opportunity = () => ({
    id: opportunityId,
    state: "HUMAN_REVIEW",
    signal: { family: "EXPRESSED_INTENT", subtype: "solution_search" },
    company: { name: "Acme Example", domain: "acme.example.com", confidence: 0.94 },
    assessment: {
      decision: "REVIEW", confidence: 0.88, evidenceStrength: 0.9, freshness: 0.98,
      commercialImpact: 0.6, icpFit: 0.4, actionability: 0.65,
      problemStatement: "We are looking for a better way to manage repeated manual vendor checks.",
    },
    evidenceCount: 2,
    evidenceStatus: "COMPLETE",
    latestReview: reviewed ? { decision: "ACCEPTED", reviewedAt: now } : null,
    createdAt: now,
    updatedAt: now,
    evidence: [{
      id: "10000000-0000-4000-8000-000000000008",
      sourceUrl: "https://example.com/intentlead-fixtures/self-prospecting-v1",
      provider: "hackernews",
      capturedAt: now,
      confidence: 0.9,
      verificationMethod: "normalized_public_source_capture",
      contentHash: "a".repeat(64),
      facts: {
        companyName: "Acme Example",
        companyDomain: "acme.example.com",
        observedCondition: "We are looking for a better way to manage repeated manual vendor checks.",
      },
    }],
    limitations: ["SYNTHETIC_CONTRACT_FIXTURE", "NO_NETWORK", "NOT_LIVE_PROVIDER_EVIDENCE"],
  });
  await page.route("**/api/discovery-briefs**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/discovery-briefs") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { discoveryBriefs: brief ? [brief] : [] } }) });
    }
    if (request.method() === "POST" && url.pathname === "/api/discovery-briefs") {
      const command = request.postDataJSON() as Record<string, Record<string, unknown>> & { objective: string };
      brief = {
        id: ids.brief, state: "DRAFT", objective: command.objective, criteria: command.criteria,
        offer: { id: ids.offer, name: command.offer.name, definition: { summary: command.offer.summary, outcomes: command.offer.outcomes, exclusions: command.offer.exclusions } },
        icp: { id: ids.icp, name: command.icp.name, definition: { description: command.icp.description, companyAttributes: command.icp.companyAttributes, exclusions: command.icp.exclusions } },
        createdAt: now, updatedAt: now,
      };
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ data: { discoveryBrief: { discoveryBriefId: ids.brief, workspaceId: ids.workspace, offerProfileId: ids.offer, icpDefinitionId: ids.icp, marketProfileId: ids.market, created: true } } }) });
    }
    if (request.method() === "POST" && url.pathname === `/api/discovery-briefs/${ids.brief}/run`) {
      brief = { ...brief, state: "QUEUED", updatedAt: now };
      generated = true;
      return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ data: { jobId: ids.job, status: "queued" } }) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
  await page.route("**/api/opportunities**", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!generated) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [], hasMore: false, nextCursor: null } }) });
    if (request.method() === "GET" && url.pathname === "/api/opportunities") {
      const detail = opportunity();
      const item = {
        id: detail.id, state: detail.state, signal: detail.signal, company: detail.company,
        assessment: detail.assessment, evidenceCount: detail.evidenceCount,
        evidenceStatus: detail.evidenceStatus, latestReview: detail.latestReview,
        createdAt: detail.createdAt, updatedAt: detail.updatedAt,
      };
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [item], hasMore: false, nextCursor: null } }) });
    }
    if (request.method() === "GET" && url.pathname === `/api/opportunities/${opportunityId}`) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: opportunity() }) });
    }
    if (request.method() === "POST" && url.pathname === `/api/opportunities/${opportunityId}/review`) {
      reviewed = true;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: {
        opportunityId, state: "ACCEPTED", decision: "ACCEPTED", reason: "RELEVANT", reviewedAt: now, replayed: false,
      } }) });
    }
    return route.fulfill({ status: 404, body: "not found" });
  });
}

test("creates and queues a zero-spend discovery brief without legacy downstream actions", async ({ page }) => {
  await installApi(page);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/e2e-fixtures/discovery");

  await expect(page.getByRole("heading", { name: "Create a discovery brief" })).toBeVisible();
  await expect(page.getByText(/technical website or SEO audit/i)).toBeVisible();
  await page.getByRole("button", { name: "Create discovery brief" }).click();
  await expect(page.getByRole("status")).toContainText("Discovery brief created");
  await expect(page.getByRole("heading", { name: /Find companies showing/ })).toBeVisible();
  await page.getByRole("button", { name: "Run zero-spend fixture" }).click();
  await expect(page.getByRole("status")).toContainText("network cost remains $0");
  await expect(page.getByText("QUEUED", { exact: true })).toBeVisible();
  const reviewLink = page.getByRole("link", { name: "Review Opportunities" }).last();
  await expect(reviewLink).toHaveAttribute("href", "/e2e-fixtures/opportunities");
  await reviewLink.click();
  await page.getByRole("link", { name: /Acme Example/ }).click();
  const evidenceSection = page.getByRole("region", { name: "Evidence and source facts" });
  await expect(evidenceSection.getByRole("heading", { name: "Evidence and source facts" })).toBeVisible();
  await expect(evidenceSection.getByText("We are looking for a better way to manage repeated manual vendor checks.")).toBeVisible();
  await page.getByRole("button", { name: "Accept finding" }).click();
  await expect(page.getByText("This Opportunity was reviewed as accepted.")).toBeVisible();

  const controls = (await page.getByRole("button").allTextContents()).join(" ").toLowerCase();
  expect(controls).not.toMatch(/send|email|message|draft|sequence|contact/);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});
