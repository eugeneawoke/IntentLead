import { execFileSync } from "node:child_process";

const allowedMarkdown = new Set([
  "README.md",
  "docs/ENGINEERING_OVERVIEW.md",
  "docs/PRODUCT_OVERVIEW.md",
  "docs/SECURITY_AND_QUALITY.md",
]);

const forbiddenExact = new Set([
  ".env",
  ".env.local",
  "AGENTS.md",
  "CLAUDE.md",
  "DECISIONS.md",
  "DESIGN_SYSTEM.md",
  "EVIDENCE.md",
  "MEMORY.md",
  "PLAN.md",
  "TODO.md",
]);

const forbiddenPrefixes = [
  ".agents/",
  ".claude/",
  ".superpowers/",
  "docs/internal/",
  "private/",
];

const trackedFiles = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
})
  .split("\0")
  .filter(Boolean);

const violations = trackedFiles.filter((file) => {
  if (file.endsWith(".md") && !allowedMarkdown.has(file)) {
    return true;
  }

  if (forbiddenExact.has(file)) {
    return true;
  }

  return forbiddenPrefixes.some((prefix) => file.startsWith(prefix));
});

if (violations.length > 0) {
  console.error("Public-surface check failed. Remove these tracked paths:");
  for (const file of violations) {
    console.error(`- ${file}`);
  }
  process.exit(1);
}

console.log(
  `Public-surface check passed: ${trackedFiles.length} tracked files, ${allowedMarkdown.size} approved Markdown files.`,
);
