import { test, expect, type Page, type Route } from "@playwright/test";
import type { OpportunityReviewDetail } from "@/types/opportunity-review";

const ids = [
  "6a4b2e8e-f3c8-45be-a1cb-9abc12345678",
  "7b5c3f9f-04d9-46cf-b2dc-abcd23456789",
  "8c6d40a0-15ea-47d0-c3ed-bcde34567890",
];
const capturedAt = "2026-10-05T12:00:00.000Z";

function fixture(id: string, name: string): OpportunityReviewDetail {
  return {
    id, state: "HUMAN_REVIEW",
    signal: { family: "DETECTED_PROBLEM", subtype: "market_presence" },
    company: { name, domain: `${name.toLowerCase().replaceAll(" ", "-")}.example`, confidence: 0.92 },
    assessment: { decision: "REVIEW", confidence: 0.88, evidenceStrength: 0.9, freshness: 1, commercialImpact: 0.8, icpFit: 0.85, actionability: 0.8 },
    evidenceCount: 1, evidenceStatus: "COMPLETE", latestReview: null,
    createdAt: capturedAt, updatedAt: capturedAt,
    evidence: [{
      id: `${id.slice(0, 8)}-15ea-47d0-c3ed-bcde34567890`, sourceUrl: "https://example.com/research",
      provider: "exa", capturedAt, confidence: 0.9, verificationMethod: "normalized_public_source_capture",
      contentHash: "a".repeat(64), facts: { companyName: name, companyDomain: `${name.toLowerCase().replaceAll(" ", "-")}.example`, problemCategory: "website" },
    }],
    limitations: ["Evidence facts are shown separately from model interpretation.", "This discovery-only review contains no person or contact records."],
  };
}

type FixtureRecord = OpportunityReviewDetail;

async function installFixtureApi(page: Page) {
  const records = new Map<string, FixtureRecord>(ids.map((id, index) => [id, fixture(id, ["Acme Example", "Beacon Works", "Cedar Systems"][index])]));
  let failedFirstDetail = false;
  await page.route("**/api/opportunities**", async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" && url.pathname === "/api/opportunities") {
      const items = [...records.values()].map(record => ({
        id: record.id, state: record.state, signal: record.signal, company: record.company,
        assessment: record.assessment, evidenceCount: record.evidenceCount, evidenceStatus: record.evidenceStatus,
        latestReview: record.latestReview, createdAt: record.createdAt, updatedAt: record.updatedAt,
      }));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items, hasMore: false, nextCursor: null } }) });
    }
    const match = url.pathname.match(/^\/api\/opportunities\/([^/]+)(?:\/review)?$/);
    const record = match ? records.get(match[1]) : undefined;
    if (!record) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND", message: "Opportunity not found" } }) });
    if (request.method() === "GET" && !url.pathname.endsWith("/review")) {
      if (!failedFirstDetail) {
        failedFirstDetail = true;
        return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message: "Unavailable" } }) });
      }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: record }) });
    }
    if (request.method() === "POST" && url.pathname.endsWith("/review")) {
      const body = request.postDataJSON() as { decision: "ACCEPTED" | "REJECTED" | "NEEDS_RESEARCH"; reason: string };
      const state: FixtureRecord["state"] = body.decision;
      const updated = { ...record, state, latestReview: { decision: body.decision, reviewedAt: capturedAt }, updatedAt: capturedAt };
      records.set(record.id, updated);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { opportunityId: record.id, state, decision: body.decision, reason: body.reason, reviewedAt: capturedAt, replayed: false } }) });
    }
    return route.fulfill({ status: 405, body: "Method not allowed" });
  });
}

async function expectNoDownstreamControls(page: Page) {
  const labels = (await page.getByRole("button").allTextContents()).join(" ").toLowerCase();
  expect(labels).not.toMatch(/copy|export|send|email|reply|outreach|sent|credit/);
  expect(await page.locator('a[href^="mailto:"]').count()).toBe(0);
  expect(await page.locator("[tabindex]").evaluateAll(nodes => nodes.some(node => Number((node as HTMLElement).getAttribute("tabindex")) > 0))).toBe(false);
}

test("local fixture member reviews evidence and can recover from a failed detail load", async ({ page }) => {
  await installFixtureApi(page);
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/e2e-fixtures/opportunities");
  await expect(page.getByRole("heading", { name: "Opportunities" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Acme Example/ })).toBeVisible();

  const firstOpportunity = page.getByRole("link", { name: /Acme Example/ });
  let focusedByTab = false;
  for (let step = 0; step < 30 && !focusedByTab; step += 1) {
    await page.keyboard.press("Tab");
    focusedByTab = await firstOpportunity.evaluate(element => element === document.activeElement);
  }
  expect(focusedByTab).toBe(true);
  expect(await firstOpportunity.evaluate(element => element.matches(":focus-visible"))).toBe(true);
  expect(await firstOpportunity.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Could not load Opportunity" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Evidence and source facts" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open public source/ })).toHaveAttribute("href", "https://example.com/research");
  await expectNoDownstreamControls(page);

  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.locator("#review-reason")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Reason for rejection or more research")).toHaveAttribute("aria-describedby", "review-reason-help review-error");
  await page.getByLabel("Reason for rejection or more research").selectOption("WEAK_SIGNAL");
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await expect(page.getByText("This Opportunity was reviewed as rejected.")).toBeVisible();

  await page.getByRole("link", { name: /All Opportunities/ }).click();
  await page.getByRole("link", { name: /Beacon Works/ }).click();
  await page.getByRole("button", { name: "Accept finding" }).click();
  await expect(page.getByText("This Opportunity was reviewed as accepted.")).toBeVisible();

  await page.getByRole("link", { name: /All Opportunities/ }).click();
  await page.getByRole("link", { name: /Cedar Systems/ }).click();
  await page.getByRole("button", { name: "Needs research" }).click();
  await page.getByLabel("Reason for rejection or more research").selectOption("OTHER");
  await page.getByRole("button", { name: "Needs research" }).click();
  await expect(page.locator("#review-note")).toHaveAttribute("aria-invalid", "true");
  await page.getByLabel("Brief note (do not include contact details)").fill("Need one stronger source.");
  await page.getByRole("button", { name: "Needs research" }).click();
  await expect(page.getByText("This Opportunity was reviewed as needs research.")).toBeVisible();
  await expectNoDownstreamControls(page);

  await page.setViewportSize({ width: 375, height: 844 });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({ path: "test-results/task8-opportunity-review-mobile.png" });
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
  expect(await page.getByRole("main").count()).toBeGreaterThan(0);
  expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
});
