import { logger } from "@/lib/utils/logger";
import { signWorkerRequest } from "./workerSignature";

export function dispatchToWorker(jobId: string): void {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret?.trim()) {
    logger.error({ jobId, wakeup: "failed", code: "WAKE_CONFIG_MISSING" }, "Worker wake hint unavailable");
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const url = new URL(`${workerUrl.replace(/\/$/, "")}/internal/jobs/wake`);
  const body = JSON.stringify({ jobId });

  // Fire and forget — do NOT await
  void fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...signWorkerRequest(workerSecret, "POST", url.pathname + url.search, body),
    },
    body,
    signal: controller.signal,
  }).then((response) => {
    if (!response.ok) {
      logger.error({ jobId, wakeup: "failed", code: "WAKE_REQUEST_REJECTED", status: response.status }, "Worker wake hint failed");
    }
  }).catch(() => {
    logger.error({ jobId, wakeup: "failed", code: "WAKE_REQUEST_FAILED" }, "Worker wake hint failed");
  }).finally(() => {
    clearTimeout(timeout);
  });
}
