import { logger } from "@/lib/utils/logger";
import { signWorkerRequest } from "./workerSignature";

export function dispatchToWorker(campaignId: string): void {
  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SECRET;
  if (!workerUrl || !workerSecret?.trim()) {
    logger.error({ campaignId }, "WORKER_URL or WORKER_SECRET not configured");
    return;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const url = new URL(`${workerUrl.replace(/\/$/, "")}/internal/run-pipeline`);
  const body = JSON.stringify({ campaignId });

  // Fire and forget — do NOT await
  fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...signWorkerRequest(workerSecret, "POST", url.pathname + url.search, body),
    },
    body,
    signal: controller.signal,
  }).catch((fetchErr) => {
    clearTimeout(timeout);
    logger.error({ campaignId, err: String(fetchErr) }, "Worker dispatch failed");
  }).then(() => {
    clearTimeout(timeout);
  });
}
