import { createWorkerApp } from "./app";

// Throws before listen when the secret is missing, empty or whitespace-only.
const app = createWorkerApp(process.env.WORKER_SECRET);
const PORT = process.env.PORT || 3001;

function log(level: string, meta: Record<string, unknown>, msg: string) {
  process.stdout.write(JSON.stringify({ level, ts: new Date().toISOString(), msg, ...meta }) + "\n");
}

app.listen(PORT, () => {
  log("info", { port: PORT }, "Worker started");
});
