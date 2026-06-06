import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 15_000,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    // Abort if CSS variables missing (Signal Dark check)
    colorScheme: "dark",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Don't start a dev server — assume it's already running
  webServer: undefined,
});
