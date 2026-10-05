import { createWorkerApp } from "./app";
import { getServiceClient } from "../lib/supabase/client";
import { createSupabaseJobRepository, type JobDatabaseClient } from "./jobs/repository";
import { createJobWorker, resolveHeartbeatIntervalMs } from "./jobs/worker";

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required worker configuration: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number, minimum: number, maximum: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Invalid worker configuration: ${name}`);
  }
  return parsed;
}

function optionalPositiveInteger(name: string): number | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`Invalid worker configuration: ${name}`);
  return parsed;
}

// Validate configuration and construct the durable poller before accepting HTTP.
requiredEnvironment("NEXT_PUBLIC_SUPABASE_URL");
requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
requiredEnvironment("WORKER_SECRET");
const concurrency = positiveInteger("WORKER_CONCURRENCY", 2, 1, 32);
const leaseSeconds = positiveInteger("WORKER_LEASE_SECONDS", 60, 5, 3600);
const heartbeatIntervalMs = resolveHeartbeatIntervalMs(
  leaseSeconds,
  optionalPositiveInteger("WORKER_HEARTBEAT_INTERVAL_MS"),
);
const repository = createSupabaseJobRepository(getServiceClient() as unknown as JobDatabaseClient);
const jobWorker = createJobWorker({
  repository,
  workerId: process.env.WORKER_ID?.trim() || `worker-${process.pid}`,
  concurrency,
  leaseSeconds,
  heartbeatIntervalMs,
});
const app = createWorkerApp(process.env.WORKER_SECRET, undefined, jobWorker.wake);
const port = positiveInteger("PORT", 3001, 1, 65535);
const server = app.listen(port, () => {
  jobWorker.start();
  log("info", { port, concurrency, leaseSeconds, heartbeatIntervalMs }, "Durable opportunity worker started");
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  log("info", { signal }, "Worker shutdown requested");
  server.close(() => undefined);
  await jobWorker.shutdown();
  log("info", { signal }, "Worker shutdown complete");
}

process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
process.once("SIGINT", () => { void shutdown("SIGINT"); });
