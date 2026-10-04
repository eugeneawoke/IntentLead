import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { WorkerSignedRequest } from "../../types/worker-auth";

export const WORKER_CLOCK_WINDOW_SECONDS = 60;

export function requireWorkerSecret(secret: string | undefined): string {
  if (!secret?.trim()) throw new Error("WORKER_SECRET must be configured and non-empty");
  return secret;
}

function signatureFor(secret: string, request: WorkerSignedRequest): Buffer {
  const bodyHash = createHash("sha256").update(request.body).digest("hex");
  const canonical = ["v1", request.method, request.path, bodyHash, request.timestamp, request.nonce].join("\n");
  return createHmac("sha256", secret).update(canonical).digest();
}

export function signWorkerRequest(secret: string, method: string, path: string, body: string) {
  requireWorkerSecret(secret);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = randomUUID();
  return {
    "x-worker-timestamp": timestamp,
    "x-worker-nonce": nonce,
    "x-worker-signature": signatureFor(secret, { method, path, body, timestamp, nonce }).toString("hex"),
  };
}

export function verifyWorkerSignature(secret: string, request: WorkerSignedRequest, signature: string): boolean {
  if (!secret.trim() || !/^\d{10}$/.test(request.timestamp)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.nonce)
    || !/^[0-9a-f]{64}$/.test(signature)) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(request.timestamp));
  if (age > WORKER_CLOCK_WINDOW_SECONDS) return false;
  return timingSafeEqual(signatureFor(secret, request), Buffer.from(signature, "hex"));
}
