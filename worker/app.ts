import express from "express";
import { requireWorkerSecret } from "../lib/auth/workerSignature";
import type { ConsumeWorkerNonce } from "../types/worker-auth";
import { consumeWorkerNonce, requireInternalKey } from "./authentication";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createWorkerApp(
  secret: string | undefined,
  consumeNonce: ConsumeWorkerNonce = consumeWorkerNonce,
  wakeJob: (jobId: string) => void = () => undefined,
) {
  const configuredSecret = requireWorkerSecret(secret);
  const app = express();
  // Authenticate the exact wire bytes before JSON parsing; compressed bodies are unsupported.
  app.use("/internal", express.raw({ type: () => true, limit: "32kb", inflate: false }));
  app.use("/internal", requireInternalKey(configuredSecret, consumeNonce));

  app.get("/internal/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", ts: new Date().toISOString() } });
  });

  app.post("/internal/jobs/wake", (req, res) => {
    let body: unknown;
    try {
      body = JSON.parse(req.body.toString("utf8"));
    } catch {
      res.status(400).json({ success: false, error: "Invalid JSON" });
      return;
    }
    const jobId = body && typeof body === "object" && !Array.isArray(body) && "jobId" in body
      ? (body as { jobId?: unknown }).jobId
      : undefined;
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).length !== 1 || typeof jobId !== "string" || !UUID_PATTERN.test(jobId)) {
      res.status(400).json({ success: false, error: "Invalid job wake hint" });
      return;
    }
    try { wakeJob(jobId); } catch {
      process.stderr.write(JSON.stringify({ level: "warn", jobId, code: "WAKE_SIGNAL_FAILED", msg: "Job wake hint was not delivered; polling remains active" }) + "\n");
    }
    res.status(202).json({ success: true, data: { accepted: true } });
  });
  return app;
}
