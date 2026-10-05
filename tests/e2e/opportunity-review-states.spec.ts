import { test, expect, type Page, type Route } from "@playwright/test";
import type { OpportunityReviewDetail } from "@/types/opportunity-review";

const ids = {
  first: "6a4b2e8e-f3c8-45be-a1cb-9abc12345678",
  second: "7b5c3f9f-04d9-46cf-b2dc-abcd23456789",
  partial: "8c6d40a0-15ea-47d0-c3ed-bcde34567890",
  missing: "9d7e51b1-26fb-48e1-d4fe-cdef45678901",
};
const now = "2026-10-05T12:00:00.000Z";

function record(id: string, status: "COMPLETE" | "PARTIAL" | "MISSING" = "COMPLETE"): OpportunityReviewDetail {
  const withEvidence = status !== "MISSING";
  return {
    id, state: "HUMAN_REVIEW", signal: { family: "DETECTED_PROBLEM", subtype: "website" },
    company: { name: `Company ${id.slice(0, 4)}`, domain: "company.example", confidence: 0.9 },
    assessment: {
      decision: "REVIEW", confidence: 0.8, evidenceStrength: 0.8, freshness: 0.9,
      commercialImpact: 0.7, icpFit: 0.75, actionability: 0.8,
      problemStatement: "The company may be losing customers because its homepage is unavailable.",
    },
    evidenceCount: withEvidence ? 1 : 0, evidenceStatus: status, latestReview: null,
    createdAt: now, updatedAt: now,
    evidence: withEvidence ? [{
      id: `${id.slice(0, 8)}-15ea-47d0-c3ed-bcde34567890`, sourceUrl: "https://example.com/source",
      provider: "fixture", capturedAt: now, confidence: 0.9, verificationMethod: "fixture_public_source_capture",
      contentHash: "a".repeat(64), facts: {
        companyName: `Company ${id.slice(0, 4)}`, problemCategory: "website",
        problem: { category: "website", observedCondition: "The homepage returned an unavailable page." },
      },
    }] : [],
    limitations: ["Evidence facts are shown separately from model interpretation."],
  };
}

function listItem(item: OpportunityReviewDetail) {
  return {
    id: item.id, state: item.state, signal: item.signal, company: item.company,
    assessment: item.assessment, evidenceCount: item.evidenceCount, evidenceStatus: item.evidenceStatus,
    latestReview: item.latestReview, createdAt: item.createdAt, updatedAt: item.updatedAt,
  };
}

async function installApi(page: Page, records: OpportunityReviewDetail[], listHandler: (route: Route, url: URL) => Promise<void>) {
  const byId = new Map(records.map(item => [item.id, item]));
  await page.route("**/api/opportunities**", async route => {
    const url = new URL(route.request().url());
    if (route.request().method() !== "GET") return route.fulfill({ status: 405, body: "Method not allowed" });
    if (url.pathname === "/api/opportunities") return listHandler(route, url);
    const match = url.pathname.match(/^\/api\/opportunities\/([^/]+)$/);
    const item = match ? byId.get(match[1]) : undefined;
    return item
      ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: item }) })
      : route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: { code: "NOT_FOUND" } }) });
  });
}

async function expectNoDownstreamControls(page: Page) {
  const labels = (await page.getByRole("button").allTextContents()).join(" ").toLowerCase();
  expect(labels).not.toMatch(/copy|export|send|email|reply|outreach|sent|credit/);
  await expect(page.locator('a[href="/chat"], a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /new campaign|start your first/i })).toHaveCount(0);
  expect(await page.locator("[tabindex]").evaluateAll(nodes => nodes.some(node => Number((node as HTMLElement).getAttribute("tabindex")) > 0))).toBe(false);
}

function contrast(foreground: string, background: string): number {
  const channels = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
  const luminance = (value: string) => channels(value).map(part => {
    const normalized = part / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("renders loading and empty states without exposing legacy campaign or chat navigation", async ({ page }) => {
  await installApi(page, [], async route => {
    await new Promise(resolve => setTimeout(resolve, 250));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [], hasMore: false, nextCursor: null } }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e2e-fixtures/opportunities");
  await expect(page.getByText("Loading Opportunities…")).toBeVisible();
  await expect(page.getByRole("heading", { name: "No Opportunities to review" })).toBeVisible();
  await expectNoDownstreamControls(page);
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  }
});

test("list error can retry, accepted is the visible status, and small labels meet contrast", async ({ page }) => {
  const accepted = { ...record(ids.first), latestReview: { decision: "ACCEPTED" as const, reviewedAt: now } };
  let calls = 0;
  await installApi(page, [accepted], async route => {
    calls += 1;
    if (calls === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR" } }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [listItem(accepted)], hasMore: false, nextCursor: null } }) });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e2e-fixtures/opportunities");
  await expect(page.getByRole("heading", { name: "Could not load Opportunities" })).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Accepted", { exact: true })).toBeVisible();
  await expect(page.getByText("Awaiting review", { exact: true })).toHaveCount(0);
  const label = page.getByText("Signal", { exact: true });
  const colors = await label.evaluate(element => ({
    foreground: getComputedStyle(element).color,
    background: getComputedStyle(element.closest("a")!).backgroundColor,
  }));
  expect(contrast(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  await expectNoDownstreamControls(page);
});

test("load-more failures can be retried and append the next page", async ({ page }) => {
  const first = record(ids.first);
  const second = record(ids.second);
  let pageCalls = 0;
  await installApi(page, [first, second], async (route, url) => {
    if (!url.searchParams.has("cursor")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [listItem(first)], hasMore: true, nextCursor: "next-page" } }) });
    }
    pageCalls += 1;
    if (pageCalls === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "INTERNAL_ERROR" } }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [listItem(second)], hasMore: false, nextCursor: null } }) });
  });
  await page.goto("/e2e-fixtures/opportunities");
  await expect(page.getByRole("link", { name: /Company 6a4b/ })).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Load more" }).click();
  await expect(page.getByRole("link", { name: /Company 7b5c/ })).toBeVisible();
  await expectNoDownstreamControls(page);
});

test("partial and missing detail evidence stay explicit and separate from interpretation on desktop", async ({ page }) => {
  const partial = record(ids.partial, "PARTIAL");
  const missing = record(ids.missing, "MISSING");
  await installApi(page, [partial, missing], async route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: { items: [listItem(partial), listItem(missing)], hasMore: false, nextCursor: null } }),
  }));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/e2e-fixtures/opportunities/${ids.partial}`);
  await expect(page.getByText(/Some linked evidence is missing/)).toBeVisible();
  await expect(page.getByText("Observed condition (fact)")).toBeVisible();
  await expect(page.getByText("The homepage returned an unavailable page.")).toBeVisible();
  await expect(page.getByText("Problem interpretation")).toBeVisible();
  await expect(page.getByText("The company may be losing customers because its homepage is unavailable.")).toBeVisible();
  await expectNoDownstreamControls(page);
  await page.goto(`/e2e-fixtures/opportunities/${ids.missing}`);
  await expect(page.getByText(/No active evidence is available/)).toBeVisible();
  await expect(page.getByText("No active source items are available.")).toBeVisible();
  await expectNoDownstreamControls(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
});
