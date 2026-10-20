import { expect, test, type Page } from "@playwright/test";

const FOOTER_DESTINATIONS = [
  "/privacy",
  "/terms",
  "/pricing",
  "/compare",
  "/methodology",
  "/roadmap",
] as const;

const RETIRED_PRICING_ACTIONS =
  /select|choose|get|buy|start free|open workspace|discuss pilot|join waitlist|talk to us/i;

async function expectPublicShell(page: Page) {
  await expect(page.locator("header.site-header")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Page sections" })).toBeVisible();

  const footer = page.locator('[data-public-shell="footer"]');
  await expect(footer).toHaveCount(1);
  await expect(footer).toBeVisible();
  for (const destination of FOOTER_DESTINATIONS) {
    await expect(
      footer.locator(`a[href="${destination}"]`),
      `footer is missing a direct ${destination} destination`
    ).toBeVisible();
  }

  const primaryAction = page.locator("[data-public-primary-action]");
  await expect(primaryAction).toBeVisible();
  await primaryAction.focus();
  await expect(primaryAction).toBeFocused();
}

test("landing exposes the June public shell and footer destinations", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);
  await expectPublicShell(page);
});

test("landing tells the four-step Opportunity story without pricing controls", async ({ page }) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  for (const anchor of ["hero", "how", "pricing", "try"] as const) {
    await expect(page.locator(`#${anchor}`), `landing is missing #${anchor}`).toBeVisible();
  }

  const workflow = page.locator("#how");
  for (const step of [
    "Commercial evidence found",
    "Company resolved",
    "Buyer resolved",
    "Grounded brief prepared",
  ]) {
    await expect(workflow.getByText(step, { exact: true })).toBeVisible();
  }

  const pilot = page.locator("#pricing");
  await expect(pilot.getByText("The first diagnostic pilot is free", { exact: true })).toBeVisible();
  await expect(pilot.getByRole("button")).toHaveCount(0);
  await expect(
    pilot.getByRole("link", {
      name: RETIRED_PRICING_ACTIONS,
    })
  ).toHaveCount(0);
});

test("retired pricing-action guard covers every historical plan CTA", () => {
  for (const label of ["Open workspace", "Discuss pilot", "Join waitlist", "Talk to us"]) {
    expect(label).toMatch(RETIRED_PRICING_ACTIONS);
  }
});

test("landing composer preserves conversational discovery handoff", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const composer = page.locator('[data-composer-id="hero"]');
  await expect(composer).toHaveAttribute("data-composer-ready", "true");
  await expect(composer.getByRole("combobox", { name: "Discovery mode" })).toBeVisible();
  await expect(composer.getByRole("menuitemradio")).toHaveCount(0);
  const input = composer.getByLabel("Describe your offer and ideal customer");
  const submit = composer.getByRole("button", { name: "Continue to conversational discovery" });
  await input.fill("Audit workflow for regional SaaS teams");
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page).toHaveURL(/\/chat\?init=Audit%20workflow%20for%20regional%20SaaS%20teams$/);
});

test("landing grid avoids hundreds of server-rendered React cells", async ({ request }) => {
  const response = await request.get("/");
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html.match(/class="grid-cell"/g) ?? []).toHaveLength(0);
  expect(html.match(/data-grid-canvas/g) ?? []).toHaveLength(1);
  expect(html.match(/data-grid-fallback/g) ?? []).toHaveLength(1);
  expect(html).toContain('data-grid-painted="false"');
});

test("landing first paint shows the SSR grid fallback before hydration", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const grid = page.locator(".grid-container");
  const fallback = grid.locator("[data-grid-fallback]");
  await expect(grid).toHaveAttribute("data-grid-painted", "false");
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveCSS("background-image", /linear-gradient/);
  expect(Number(await fallback.evaluate((element) => getComputedStyle(element).opacity))).toBeGreaterThan(0);
  await context.close();
});

test("mobile grid fills portrait tracks and hands SSR fallback to canvas", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const grid = page.locator(".grid-container");
  const canvas = grid.locator("[data-grid-canvas]");
  const fallback = grid.locator("[data-grid-fallback]");
  await expect(canvas).toHaveAttribute("data-painted", "true");
  await expect(grid).toHaveAttribute("data-grid-painted", "true");

  const geometry = await canvas.evaluate((element) => ({
    cellWidth: Number(element.dataset.cellWidth),
    cellHeight: Number(element.dataset.cellHeight),
    trackWidth: Number(element.dataset.trackWidth),
    trackHeight: Number(element.dataset.trackHeight),
    gap: Number(element.dataset.gap),
    originX: Number(element.dataset.cellOriginX),
    originY: Number(element.dataset.cellOriginY),
  }));
  expect(geometry.cellHeight / geometry.trackHeight).toBeGreaterThan(0.8);
  expect(geometry.gap / geometry.cellHeight).toBeLessThan(0.2);
  expect(geometry.cellHeight / geometry.cellWidth).toBeGreaterThan(2);
  expect({ x: geometry.originX, y: geometry.originY }).toEqual({ x: 0, y: 0 });
  await expect(fallback).toHaveCSS("background-image", /linear-gradient/);
  await expect(fallback).toHaveCSS("opacity", "0");
});

test("landing grid pauses its draw loop offscreen and resumes on return", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const canvas = page.locator("[data-grid-canvas]");
  await expect(canvas).toHaveAttribute("data-motion", "running");

  await page.locator("#try").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-motion", "paused");
  const offscreenDraws = await canvas.evaluate(async (element) => {
    const instrumented = element as HTMLCanvasElement & { __gridDrawCount?: number };
    const start = instrumented.__gridDrawCount ?? 0;
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return (instrumented.__gridDrawCount ?? 0) - start;
  });
  expect(offscreenDraws).toBe(0);

  await page.locator("#hero").scrollIntoViewIfNeeded();
  await expect(canvas).toHaveAttribute("data-motion", "running");
  const resumedDraws = await canvas.evaluate(async (element) => {
    const instrumented = element as HTMLCanvasElement & { __gridDrawCount?: number };
    const start = instrumented.__gridDrawCount ?? 0;
    for (let frame = 0; frame < 8; frame += 1) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    return (instrumented.__gridDrawCount ?? 0) - start;
  });
  expect(resumedDraws).toBeGreaterThan(0);
});

test("landing grid has bounded normal motion and a working pointer glow", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const hero = page.locator(".data-grid-hero");
  const canvas = hero.locator("[data-grid-canvas]");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-motion", "running");
  await expect.poll(async () => Number(await canvas.getAttribute("data-frame"))).toBeGreaterThan(0);
  await expect.poll(() => hero.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBeLessThan(10);

  const box = await hero.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height * 0.35);
  await expect.poll(() => hero.evaluate((element) => ({
    x: element.style.getPropertyValue("--mouse-x"),
    y: element.style.getPropertyValue("--mouse-y"),
  }))).toEqual({
    x: `${Math.round(box!.width * 0.25)}px`,
    y: `${Math.round(box!.height * 0.35)}px`,
  });
});

test("landing applies reduced motion without an active grid animation", async ({ page }) => {
  const hydrationProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /hydration|did not match|server rendered html/i.test(message.text())) {
      hydrationProblems.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|did not match|server rendered html/i.test(error.message)) {
      hydrationProblems.push(error.message);
    }
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const grid = page.locator(".data-grid-hero");
  await expect(grid.locator("[data-grid-canvas]")).toBeVisible();
  await expect.poll(() => grid.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
  await expect(grid.locator("[data-grid-canvas]")).toHaveAttribute("data-motion", "reduced");
  expect(hydrationProblems).toEqual([]);
});

for (const path of ["/privacy", "/terms", "/methodology", "/roadmap"] as const) {
  test(`${path} retains document hierarchy, footer and mobile fit`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBe(200);

    await expect(page.locator("h1")).toHaveCount(1);
    expect(await page.locator("main section").count()).toBeGreaterThanOrEqual(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    const footer = page.locator('[data-public-shell="footer"]');
    await expect(footer).toHaveCount(1);
    await expect(footer).toBeVisible();
    for (const destination of FOOTER_DESTINATIONS) {
      await expect(footer.locator(`a[href="${destination}"]`)).toBeVisible();
    }
  });
}

test("pricing presents Pilot Access without plans, toggles or purchase actions", async ({ page }) => {
  const response = await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.getByText("The first diagnostic pilot is free", { exact: true })).toBeVisible();
  await expect(page.getByText(/at least 20 confirmed, evidence-backed signals/i)).toBeVisible();
  await expect(page.getByText(/PARTIAL/)).toBeVisible();
  await expect(page.getByText(/individual agreement/i)).toBeVisible();
  await expect(page.locator('[data-plan-card], [role="switch"], input[type="radio"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: /buy|purchase|checkout|select plan|choose plan/i })).toHaveCount(0);
  await expect(page.getByText(/\$\d+|credits?\/mo/i)).toHaveCount(0);
});

test("comparison index links every supported June competitor", async ({ page }) => {
  const response = await page.goto("/compare", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  for (const slug of ["apollo", "clay", "hunter", "instantly", "lemlist"] as const) {
    await expect(page.locator(`a[href="/compare/${slug}"]`).first()).toBeVisible();
  }
});

test("comparison detail keeps sticky tables and an accessible mobile scroll region", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/compare/apollo", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  await expect(page.locator("h1")).toHaveCount(1);
  await expect(page.locator('[data-compare-sticky="true"]')).toHaveCount(2);
  const scrollRegion = page.getByRole("region", { name: "IntentLead and Apollo.io comparison" });
  await expect(scrollRegion).toBeVisible();
  expect(await scrollRegion.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
});

test("public header routes closed Pilot Access without opening unrestricted signup", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const pilotAccess = page.locator("header.site-header").getByRole("link", { name: "Pilot Access", exact: true });
  await expect(pilotAccess).toHaveAttribute("href", "/pricing");
  await pilotAccess.click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByText("Create account", { exact: true })).toHaveCount(0);
});

test("header localizes Pilot Access on landing and hides language toggle on English-only routes", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const languageToggle = page.locator("[data-language-toggle]");
  await expect(languageToggle).toBeVisible();
  await languageToggle.click();
  await expect(page.getByRole("link", { name: "Обсудить пилот", exact: true })).toHaveAttribute("href", "/pricing");

  for (const path of ["/pricing", "/compare", "/compare/apollo", "/methodology", "/roadmap", "/privacy", "/terms"] as const) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-language-toggle]"), `${path} should not expose a language toggle`).toHaveCount(0);
  }
});

test("saved Russian applies only to the localized landing page", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.locator("[data-language-toggle]").click();
  await expect(page.locator("header.site-header").getByRole("button", { name: "Войти", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Обсудить пилот", exact: true })).toBeVisible();

  await page.goto("/pricing", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-language-toggle]")).toHaveCount(0);
  await expect(page.locator("header.site-header").getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await expect(page.locator("header.site-header").getByRole("link", { name: "Pilot Access", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "The first diagnostic pilot is free" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Methodology", exact: true })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Privacy", exact: true })).toBeVisible();

  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("header.site-header").getByRole("button", { name: "Войти", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Обсудить пилот", exact: true })).toBeVisible();
});

test("comparison index retains the June workflow, demonstrations, matrix and related hierarchy", async ({ page }) => {
  await page.goto("/compare", { waitUntil: "domcontentloaded" });
  for (const section of ["workflow", "evidence-demo", "resolution-demo", "review-demo", "matrix", "related"] as const) {
    await expect(page.locator(`[data-compare-section="${section}"]`), `missing June comparison section ${section}`).toHaveCount(1);
  }
  expect(await page.locator('[data-browser-mockup="true"]').count()).toBeGreaterThanOrEqual(3);
});

test("comparison detail retains the June pain, workflow, fit, table and related hierarchy", async ({ page }) => {
  await page.goto("/compare/apollo", { waitUntil: "domcontentloaded" });
  for (const section of ["pain-points", "workflow-demos", "fit-comparison", "feature-table", "who-for", "related", "decision"] as const) {
    await expect(page.locator(`[data-compare-detail-section="${section}"]`), `missing June detail section ${section}`).toHaveCount(1);
  }
  expect(await page.locator('[data-browser-mockup="true"]').count()).toBeGreaterThanOrEqual(3);
});

for (const comparison of [
  { path: "/compare", region: "IntentLead competitor comparison" },
  { path: "/compare/apollo", region: "IntentLead and Apollo.io comparison" },
] as const) {
  test(`${comparison.path} synchronizes comparison headings and exposes column semantics`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(comparison.path, { waitUntil: "domcontentloaded" });

    const body = page.getByRole("region", { name: comparison.region });
    const header = page.locator("[data-compare-header-scroll]");
    await expect(body.locator('thead th[scope="col"]')).toHaveCount(comparison.path === "/compare" ? 7 : 3);

    await body.evaluate((element) => {
      element.scrollLeft = 260;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect.poll(() => header.evaluate((element) => element.scrollLeft)).toBe(260);
    await expect
      .poll(() => header.locator("th").first().evaluate((element) => getComputedStyle(element).position))
      .toBe("sticky");
  });
}
