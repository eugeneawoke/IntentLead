import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execute = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const integrationDirectory = path.join(root, "tests", "integration");
const configuredUrl = process.env.INTENTLEAD_TEST_DATABASE_URL;

if (!configuredUrl) {
  throw new Error("INTENTLEAD_TEST_DATABASE_URL is required for integration tests");
}

const adminUrl = new URL(configuredUrl);
const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);
const configuredDatabase = decodeURIComponent(adminUrl.pathname.slice(1));
if (!allowedHosts.has(adminUrl.hostname) || !/^intentlead_test_[a-z0-9_]+$/.test(configuredDatabase)) {
  throw new Error("Integration tests require a local intentlead_test_* database URL");
}

const requestedFiles = process.argv.slice(2);
const discoveredFiles = requestedFiles.length > 0
  ? requestedFiles
  : (await readdir(integrationDirectory))
    .filter((name) => name.endsWith(".test.ts"))
    .map((name) => path.join("tests", "integration", name))
    .sort();

async function resolveTestFile(candidate) {
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(integrationDirectory, absolute);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !absolute.endsWith(".test.ts")) {
    throw new Error(`Invalid integration test path: ${candidate}`);
  }
  if (!(await stat(absolute)).isFile()) throw new Error(`Integration test not found: ${candidate}`);
  return { absolute, relative: path.relative(root, absolute) };
}

function databaseEnvironment() {
  return {
    ...process.env,
    PGHOST: adminUrl.hostname,
    PGPORT: adminUrl.port || "5432",
    PGUSER: decodeURIComponent(adminUrl.username || "postgres"),
    PGPASSWORD: decodeURIComponent(adminUrl.password),
    PGDATABASE: "postgres",
    PGCONNECT_TIMEOUT: "3",
  };
}

function isolatedDatabaseUrl(databaseName) {
  const url = new URL(configuredUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function isolatedDatabaseName(relativeFile) {
  const slug = path.basename(relativeFile, ".test.ts").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 24);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 8);
  return `intentlead_test_${process.pid}_${slug}_${suffix}`.slice(0, 63);
}

const failures = [];
for (const candidate of discoveredFiles) {
  const testFile = await resolveTestFile(candidate);
  const databaseName = isolatedDatabaseName(testFile.relative);
  const databaseEnv = databaseEnvironment();
  process.stdout.write(`\n[integration] ${testFile.relative}\n`);
  try {
    await execute("createdb", [databaseName], { cwd: root, env: databaseEnv, maxBuffer: 10 * 1024 * 1024 });
    const result = await execute(process.execPath, [
      path.join(root, "node_modules", "vitest", "vitest.mjs"),
      "run",
      "--config",
      "vitest.integration.config.ts",
      testFile.relative,
    ], {
      cwd: root,
      env: { ...process.env, INTENTLEAD_TEST_DATABASE_URL: isolatedDatabaseUrl(databaseName) },
      maxBuffer: 50 * 1024 * 1024,
    });
    process.stdout.write(result.stdout);
    process.stderr.write(result.stderr);
  } catch (error) {
    if (error?.stdout) process.stdout.write(error.stdout);
    if (error?.stderr) process.stderr.write(error.stderr);
    failures.push(testFile.relative);
  } finally {
    try {
      await execute("dropdb", ["--if-exists", "--force", databaseName], {
        cwd: root,
        env: databaseEnv,
        maxBuffer: 10 * 1024 * 1024,
      });
    } catch (error) {
      if (error?.stderr) process.stderr.write(error.stderr);
      failures.push(`${testFile.relative} (database cleanup)`);
    }
  }
}

if (failures.length > 0) {
  process.stderr.write(`\nIntegration failures:\n${[...new Set(failures)].map((file) => `- ${file}`).join("\n")}\n`);
  process.exitCode = 1;
}
