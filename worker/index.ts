// Worker placeholder — full implementation in Phase 5
import express from "express";

const app = express();
const PORT = process.env.PORT || 3001;

app.get("/internal/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  process.stdout.write(JSON.stringify({ level: "info", msg: "worker started", port: PORT }) + "\n");
});

export default app;
