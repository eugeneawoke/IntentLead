import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { signWorkerRequest } from "@/lib/auth/workerSignature";
import { createWorkerApp } from "@/worker/app";

const serverRefs: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(serverRefs.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
});

async function postWake(body: string, wake: (jobId: string) => void) {
  const secret = "task5-secret";
  const consumeNonce = vi.fn().mockResolvedValue(true);
  const app = createWorkerApp(secret, consumeNonce, wake);
  const server = createServer(app);
  serverRefs.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected a TCP server address");
  const path = "/internal/jobs/wake";
  const headers = signWorkerRequest(secret, "POST", path, body);
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("durable job wake endpoint", () => {
  it("validates a job id and returns quickly after signaling the poller", async () => {
    const wake = vi.fn();
    const response = await postWake(JSON.stringify({ jobId: "00000000-0000-4000-8000-000000000099" }), wake);

    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ success: true, data: { accepted: true } });
    expect(wake).toHaveBeenCalledWith("00000000-0000-4000-8000-000000000099");
  });

  it("rejects a malformed wake hint without running work", async () => {
    const wake = vi.fn();
    const response = await postWake(JSON.stringify({ discoveryBriefId: "brief-1" }), wake);

    expect(response.status).toBe(400);
    expect(wake).not.toHaveBeenCalled();
  });
});
