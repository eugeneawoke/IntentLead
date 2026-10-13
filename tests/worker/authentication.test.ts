import { createHash, createHmac, randomUUID } from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWorkerApp } from "../../worker/app";
import { dispatchToWorker } from "@/lib/auth/dispatchToWorker";

vi.mock("@/lib/utils/logger", () => ({ logger: { error: vi.fn() } }));

const secret = "test-only-worker-secret";
let server: Server | undefined;
const consumeNonce = vi.fn();
const wakeJob = vi.fn();

// Independent protocol implementation so signer and verifier cannot agree on the same bug.
function headers(body = "", path = "/internal/health", method = "GET", timestamp = Math.floor(Date.now() / 1000), signingSecret = secret) {
  const nonce = randomUUID();
  const canonical = ["v1", method, path, createHash("sha256").update(body).digest("hex"), String(timestamp), nonce].join("\n");
  return {
    "content-type": "application/json",
    "x-worker-timestamp": String(timestamp),
    "x-worker-nonce": nonce,
    "x-worker-signature": createHmac("sha256", signingSecret).update(canonical).digest("hex"),
  };
}

async function listen() {
  const app = createWorkerApp(secret, consumeNonce, wakeJob);
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server!.once("listening", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(() => {
  vi.clearAllMocks();
  consumeNonce.mockResolvedValue(true);
  wakeJob.mockReset();
});
afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
  server = undefined;
});

describe("worker authentication", () => {
  it.each([undefined, "", "   "])("fails startup with missing/empty secret %s", (value) => {
    expect(() => createWorkerApp(value, consumeNonce)).toThrow("WORKER_SECRET");
  });

  it("accepts a valid signature after the nonce repository approves it", async () => {
    const url = await listen();
    const signed = headers();
    expect((await fetch(`${url}/internal/health`, { headers: signed })).status).toBe(200);
    expect(consumeNonce).toHaveBeenCalledExactlyOnceWith(signed["x-worker-nonce"], Number(signed["x-worker-timestamp"]));
  });

  it.each(["missing", "empty", "wrong", "expired", "future", "malformed", "legacy"])("rejects %s authentication before nonce storage", async (kind) => {
    const url = await listen();
    let signed: Record<string, string> = headers();
    if (kind === "missing") signed = {};
    if (kind === "empty") signed["x-worker-signature"] = "";
    if (kind === "wrong") signed = headers("", "/internal/health", "GET", Math.floor(Date.now() / 1000), "wrong-secret");
    if (kind === "expired") signed = headers("", "/internal/health", "GET", Math.floor(Date.now() / 1000) - 61);
    if (kind === "future") signed = headers("", "/internal/health", "GET", Math.floor(Date.now() / 1000) + 120);
    if (kind === "legacy") signed = { "x-internal-key": secret };
    // Headers require ByteString; use non-hex ASCII to exercise length-safe parsing.
    if (kind === "malformed") signed["x-worker-signature"] = "z".repeat(64);
    expect((await fetch(`${url}/internal/health`, { headers: signed })).status).toBe(401);
    expect(consumeNonce).not.toHaveBeenCalled();
  });

  it.each(["method", "path", "body"])("binds the signature to the %s", async (kind) => {
    const url = await listen();
    const body = JSON.stringify({ jobId: randomUUID() });
    const signed = headers(body, kind === "path" ? "/internal/other" : "/internal/jobs/wake", kind === "method" ? "GET" : "POST");
    const response = await fetch(`${url}/internal/jobs/wake`, {
      method: "POST", headers: signed, body: kind === "body" ? `${body} ` : body,
    });
    expect(response.status).toBe(401);
    expect(consumeNonce).not.toHaveBeenCalled();
    expect(wakeJob).not.toHaveBeenCalled();
  });

  it("rejects a request when the mocked nonce repository reports a replay", async () => {
    const url = await listen();
    consumeNonce.mockResolvedValue(false);
    expect((await fetch(`${url}/internal/health`, { headers: headers() })).status).toBe(401);
  });

  it("accepts an exact signed query string and rejects a changed query", async () => {
    const url = await listen();
    const path = "/internal/health?probe=a%2Fb&count=1";
    expect((await fetch(`${url}${path}`, { headers: headers("", path) })).status).toBe(200);
    consumeNonce.mockClear();
    expect((await fetch(`${url}${path}&extra=1`, { headers: headers("", path) })).status).toBe(401);
    expect(consumeNonce).not.toHaveBeenCalled();
  });

  it("binds the signature to the encoded path bytes", async () => {
    const url = await listen();
    const path = "/internal/%68ealth";
    expect((await fetch(`${url}${path}`, { headers: headers("", "/internal/health") })).status).toBe(401);
    expect(consumeNonce).not.toHaveBeenCalled();
    // Authentication succeeds for the exact bytes; Express has no route for this spelling.
    expect((await fetch(`${url}${path}`, { headers: headers("", path) })).status).toBe(404);
    expect(consumeNonce).toHaveBeenCalledOnce();
  });

  it("fails closed when replay persistence is unavailable", async () => {
    const url = await listen();
    consumeNonce.mockRejectedValue(new Error("database offline"));
    expect((await fetch(`${url}/internal/health`, { headers: headers() })).status).toBe(503);
    expect(wakeJob).not.toHaveBeenCalled();
  });

  it("authenticates the exact JSON bytes before signaling the durable job poller", async () => {
    const url = await listen();
    const jobId = randomUUID();
    const body = `{ "jobId": "${jobId}" }`;
    expect((await fetch(`${url}/internal/jobs/wake`, {
      method: "POST", headers: headers(body, "/internal/jobs/wake", "POST"), body,
    })).status).toBe(202);
    expect(wakeJob).toHaveBeenCalledExactlyOnceWith(jobId);
  });
});

describe("signed app dispatch", () => {
  it("sends a timestamped, unique, body-bound HMAC without exposing the secret", () => {
    vi.stubEnv("WORKER_URL", "https://worker.example.test");
    vi.stubEnv("WORKER_SECRET", secret);
    const send = vi.fn().mockResolvedValue(new Response("", { status: 202 }));
    vi.stubGlobal("fetch", send);
    const jobId = randomUUID();
    dispatchToWorker(jobId);
    dispatchToWorker(jobId);
    const [url, request] = send.mock.calls[0] as [string, RequestInit];
    const signed = request.headers as Record<string, string>;
    const normalized = new Headers(signed);
    expect(url).toBe("https://worker.example.test/internal/jobs/wake");
    expect(request.body).toBe(JSON.stringify({ jobId }));
    expect(normalized.has("x-internal-key")).toBe(false);
    const canonical = ["v1", "POST", "/internal/jobs/wake", createHash("sha256").update(request.body as string).digest("hex"), normalized.get("x-worker-timestamp"), normalized.get("x-worker-nonce")].join("\n");
    expect(normalized.get("x-worker-signature")).toBe(createHmac("sha256", secret).update(canonical).digest("hex"));
    expect(new Headers(send.mock.calls[1][1].headers).get("x-worker-nonce")).not.toBe(normalized.get("x-worker-nonce"));
  });

  it.each([undefined, "", "   "])("does not dispatch without a non-empty secret %s", (value) => {
    vi.stubEnv("WORKER_URL", "https://worker.example.test");
    vi.stubEnv("WORKER_SECRET", value);
    const send = vi.fn();
    vi.stubGlobal("fetch", send);
    dispatchToWorker("campaign");
    expect(send).not.toHaveBeenCalled();
  });
});
