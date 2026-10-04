import { createClient } from "@supabase/supabase-js";
import type { NextFunction, Request, Response } from "express";
import { verifyWorkerSignature } from "../lib/auth/workerSignature";
import type { ConsumeWorkerNonce } from "../types/worker-auth";

export async function consumeWorkerNonce(nonce: string, timestamp: number): Promise<boolean> {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.rpc("intentlead_claim_worker_nonce", {
    p_nonce: nonce, p_timestamp: timestamp,
  });
  if (error) throw new Error("Worker replay protection unavailable");
  return data === true;
}

export function requireInternalKey(secret: string, consumeNonce: ConsumeWorkerNonce) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const timestamp = req.headers["x-worker-timestamp"];
    const nonce = req.headers["x-worker-nonce"];
    const signature = req.headers["x-worker-signature"];
    if (typeof timestamp !== "string" || typeof nonce !== "string" || typeof signature !== "string"
      || !verifyWorkerSignature(secret, {
        method: req.method, path: req.originalUrl, body: Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
        timestamp, nonce,
      }, signature)) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    try {
      if (!(await consumeNonce(nonce, Number(timestamp)))) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
    } catch {
      res.status(503).json({ success: false, error: "Worker authentication unavailable" });
      return;
    }
    next();
  };
}
