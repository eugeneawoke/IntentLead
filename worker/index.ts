import express from "express";
import { timingSafeEqual } from "crypto";
import { runPipeline } from "./pipeline/runner";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

// Auth middleware for /internal/* routes
function requireInternalKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  const key = req.headers["x-internal-key"];
  const secret = process.env.WORKER_SECRET ?? "";

  if (
    typeof key !== "string" ||
    key.length !== secret.length ||
    !timingSafeEqual(Buffer.from(key), Buffer.from(secret))
  ) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  next();
}

app.get("/internal/health", requireInternalKey, (_req, res) => {
  res.json({ success: true, data: { status: "ok", ts: new Date().toISOString() } });
});

app.post("/internal/run-pipeline", requireInternalKey, async (req, res) => {
  const { campaignId } = req.body as { campaignId?: string };
  if (!campaignId) {
    res.status(400).json({ success: false, error: "campaignId required" });
    return;
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(campaignId)) {
    res.status(400).json({ success: false, error: "Invalid campaignId format" });
    return;
  }

  // Respond 202 immediately — pipeline runs async
  res.status(202).json({ success: true, data: { message: "Pipeline started", campaignId } });

  // Run pipeline in background
  runPipeline(campaignId).catch((err: unknown) => {
    log("error", { campaignId, err: String(err) }, "Pipeline top-level error");
  });
});

app.listen(PORT, () => {
  log("info", { port: PORT }, "Worker started");
});
