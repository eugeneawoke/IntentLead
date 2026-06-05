import { logger } from "@/lib/utils/logger";

export function dispatchToWorker(campaignId: string): void {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    logger.error({ campaignId }, "WORKER_URL or WORKER_SECRET not configured");
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  // Fire and forget — do NOT await
  fetch(`${workerUrl}/internal/run-pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": workerSecret,
    },
    body: JSON.stringify({ campaignId }),
    signal: controller.signal,
  }).catch((fetchErr) => {
    clearTimeout(timeout);
    logger.error({ campaignId, err: String(fetchErr) }, "Worker dispatch failed");
  }).then(() => {
    clearTimeout(timeout);
  });
}
