import { logger } from "@/lib/utils/logger";

export function dispatchToWorker(campaignId: string): void {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret) {
    logger.error({ campaignId }, "WORKER_URL or WORKER_SECRET not configured");
    return;
  }
  // Fire and forget — do NOT await
  fetch(`${workerUrl}/internal/run-pipeline`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Key": workerSecret,
    },
    body: JSON.stringify({ campaignId }),
  }).catch((dispatchErr) => {
    logger.error({ campaignId, err: String(dispatchErr) }, "Worker dispatch failed");
  });
}
