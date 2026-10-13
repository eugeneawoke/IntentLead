import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: currentDirectory });

const config = [
  {
    ignores: [
      "**/node_modules/**",
      ".next/**",
      ".claude/**",
      ".worktrees/**",
      ".superpowers/**",
      ".gitnexus/**",
      ".playwright-mcp/**",
      "next-env.d.ts",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "supabase/.temp/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Existing UI copy and navigation violations are reported until their own cleanup.
      "react/no-unescaped-entities": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  {
    files: ["components/ui/fluid-glass.tsx"],
    rules: {
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
];

export default config;
