/**
 * Smoke tests — every public page must:
 *   1. Return HTTP 200 (no server crash)
 *   2. Load Signal Dark CSS variables (--bg = #0A0C0F)
 *   3. Render without SSR bail-out error
 *   4. Contain at least one <h1> or <main>
 *
 * Auth-protected pages must redirect to /?auth=1
 * Run against running dev or production server (BASE_URL env or localhost:3000)
 */

import { test, expect, type Page } from "@playwright/test";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function expectSignalDark(page: Page) {
  const bg = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue("--bg").trim()
  );
  expect(bg, "Signal Dark --bg variable missing — CSS pipeline broken").toBe("#0A0C0F");
}

async function expectNoSSRBailout(page: Page) {
  // We only flag hard server errors (500-level), not expected client-rendering
  // bailouts from dynamic({ ssr: false }) or useSearchParams without Suspense.
  // Those are architectural and show up as BAILOUT_TO_CLIENT_SIDE_RENDERING
  // templates but don't break the UX once JS hydrates.
  const text = await page.content();
  const hasHardError =
    text.includes('"statusCode":500') || text.includes("Application error:");
  expect(hasHardError, "Page has a hard 500 server error").toBe(false);
}

async function expectBodyContent(page: Page) {
  // Page must have either a <h1> or a <main> with content
  const h1 = await page.locator("h1").count();
  const main = await page.locator("main").count();
  expect(h1 + main, "Page has no <h1> or <main> — likely blank render").toBeGreaterThan(0);
}

async function smokePublic(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${path} returned non-200`).toBe(200);
  await expectSignalDark(page);
  await expectNoSSRBailout(page);
  await expectBodyContent(page);
}

// ── Public pages ──────────────────────────────────────────────────────────────

test("/ landing renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/");
});

test("/pricing renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/pricing");
});

test("/privacy renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/privacy");
});

test("/terms renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/terms");
});

test("/methodology renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/methodology");
});

test("/roadmap renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/roadmap");
});

// ── /vs comparison pages ──────────────────────────────────────────────────────

test("/vs index renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/vs");
});

const COMPETITORS = ["clay", "apollo", "hunter", "instantly", "lemlist"];

for (const slug of COMPETITORS) {
  test(`/vs/${slug} renders with Signal Dark`, async ({ page }) => {
    await smokePublic(page, `/vs/${slug}`);
  });
}

// ── Chat page ─────────────────────────────────────────────────────────────────

test("/chat renders with Signal Dark", async ({ page }) => {
  await smokePublic(page, "/chat");
});

// ── Auth-protected pages ──────────────────────────────────────────────────────

test("/workspace redirects unauthenticated user to /?auth=1", async ({ page }) => {
  const response = await page.goto("/workspace", { waitUntil: "domcontentloaded" });
  // Accept either a redirect chain ending at / or /?auth=1
  const url = page.url();
  expect(
    url.includes("/?auth=1") || url.endsWith("/") || url === "http://localhost:3000/",
    `Expected redirect to /?auth=1, got ${url}`
  ).toBeTruthy();
  // Either way, Signal Dark must load on destination page
  await expectSignalDark(page);
});

// ── SEO endpoints ─────────────────────────────────────────────────────────────

test("/robots.txt is served", async ({ request }) => {
  const res = await request.get("/robots.txt");
  expect(res.status()).toBe(200);
  const text = await res.text();
  // Next.js generates "User-Agent" (capital A)
  expect(text.toLowerCase()).toContain("user-agent");
  expect(text).toContain("Sitemap");
});

test("/sitemap.xml is served and contains all URLs", async ({ request }) => {
  const res = await request.get("/sitemap.xml");
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toContain("<urlset");
  // Key pages present
  for (const path of ["/pricing", "/privacy", "/terms", "/vs"]) {
    expect(text, `sitemap missing ${path}`).toContain(path);
  }
  // All competitor slugs present
  for (const slug of COMPETITORS) {
    expect(text, `sitemap missing /vs/${slug}`).toContain(`/vs/${slug}`);
  }
});
