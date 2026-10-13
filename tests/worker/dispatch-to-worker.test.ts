import { afterEach, describe, expect, it, vi } from "vitest";

const errorLog = vi.fn();
vi.mock("@/lib/utils/logger", () => ({ logger: { error: errorLog, info: vi.fn(), warn: vi.fn() } }));

describe("dispatchToWorker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.WORKER_URL;
    delete process.env.WORKER_SECRET;
    vi.clearAllMocks();
  });

  it("keeps an accepted job durable when worker wake configuration is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    delete process.env.WORKER_URL;
    process.env.WORKER_SECRET = "secret-for-test";
    const { dispatchToWorker } = await import("@/lib/auth/dispatchToWorker");

    expect(() => dispatchToWorker("job-1")).not.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "job-1", wakeup: "failed" }),
      expect.any(String),
    );
  });

  it("sends only a job wake hint and does not call the campaign pipeline endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 202 });
    vi.stubGlobal("fetch", fetchMock);
    process.env.WORKER_URL = "http://127.0.0.1:3001";
    process.env.WORKER_SECRET = "secret-for-test";
    const { dispatchToWorker } = await import("@/lib/auth/dispatchToWorker");

    dispatchToWorker("job-1");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:3001/internal/jobs/wake");
    expect(JSON.parse(String(init.body))).toEqual({ jobId: "job-1" });
  });
});
