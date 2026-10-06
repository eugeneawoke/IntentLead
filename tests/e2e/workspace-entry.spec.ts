import { test, expect } from "@playwright/test";

test("workspace entry exposes discovery and review without legacy navigation", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/e2e-fixtures/workspace");

  await expect(page.getByRole("heading", { name: "Discover and review Opportunities", level: 1 })).toBeVisible();
  const discoveryLink = page.getByRole("link", { name: "Create discovery brief" });
  await expect(discoveryLink).toHaveAttribute("href", "/workspace/discovery");
  const opportunitiesLink = page.getByRole("link", { name: "View Opportunities" });
  await expect(opportunitiesLink).toHaveAttribute("href", "/workspace/opportunities");
  await expect(opportunitiesLink).toBeVisible();
  await expect(page.getByRole("link", { name: /new campaign/i })).toHaveCount(0);
  await expect(page.locator('a[href="/chat"]')).toHaveCount(0);
  await expect(page.getByText(/start your first|select a campaign/i)).toHaveCount(0);

  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(discoveryLink).toBeVisible();
    await expect(opportunitiesLink).toBeVisible();
  }
  await expect(page.getByRole("main")).toBeVisible();
});
