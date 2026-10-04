import express from "express";
import { requireWorkerSecret } from "../lib/auth/workerSignature";
import type { ConsumeWorkerNonce } from "../types/worker-auth";
import { consumeWorkerNonce, requireInternalKey } from "./authentication";
import { runPipeline } from "./pipeline/runner";

export function createWorkerApp(secret: string | undefined, consumeNonce: ConsumeWorkerNonce = consumeWorkerNonce) {
  const configuredSecret = requireWorkerSecret(secret);
  const app = express();
  // Authenticate the exact wire bytes before JSON parsing; compressed bodies are unsupported.
  app.use("/internal", express.raw({ type: () => true, limit: "32kb", inflate: false }));
  app.use("/internal", requireInternalKey(configuredSecret, consumeNonce));

  app.get("/internal/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok", ts: new Date().toISOString() } });
  });

  app.post("/internal/run-pipeline", async (req, res) => {
    let body: unknown;
    try {
      body = JSON.parse(req.body.toString("utf8"));
    } catch {
      res.status(400).json({ success: false, error: "Invalid JSON" });
      return;
    }
    const campaignId = body && typeof body === "object" && "campaignId" in body ? body.campaignId : undefined;
    if (typeof campaignId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(campaignId)) {
      res.status(400).json({ success: false, error: "Invalid campaignId format" });
      return;
    }
    // Development-only until Task 5 replaces background work with persisted jobs.
    res.status(202).json({ success: true, data: { message: "Pipeline started", campaignId } });
    runPipeline(campaignId).catch(() => {
      process.stderr.write(JSON.stringify({ level: "error", campaignId, msg: "Pipeline top-level error" }) + "\n");
    });
  });
  return app;
}
