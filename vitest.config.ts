import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    exclude: [
      ...configDefaults.exclude,
      "tests/e2e/**",
      "tests/integration/**",
      ".claude/**",
      ".worktrees/**",
      ".next/**",
      ".superpowers/**",
      "playwright-report/**",
      "test-results/**",
      "**/node_modules/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
