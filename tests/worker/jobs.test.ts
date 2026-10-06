import { describe, expect, it, vi } from "vitest";
import { createJobWorker, type ProviderConcurrencyHook } from "@/worker/jobs/worker";
import type { JobRepository, LeasedJob } from "@/worker/jobs/repository";
import type { MarketProfile } from "@/types/market-profile";
import { MarketProfileSchema } from "@/lib/domain/schemas/market-profile";

const now = "2026-10-05T10:00:00.000Z";
const discoveryProfile: MarketProfile = {
  schemaVersion: 1,
  id: "EN_DISCOVERY_ONLY",
  workspaceId: "workspace-1",
  jurisdictions: [],
  regions: [],
  languages: ["en"],
  capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
  disabledCapabilities: ["WEB_FETCH"],
  legalPolicyId: "policy-legal-v1",
  retentionPolicyId: "policy-retention-v1",
  defaultCurrency: "USD",
  timezone: "UTC",
  workflow: "DISCOVERY_ONLY",
};

const lease: LeasedJob = {
  schemaVersion: 1,
  id: "job-1",
  workspaceId: "workspace-1",
  capability: "SOURCE_SEARCH",
  marketProfileId: "EN_DISCOVERY_ONLY",
  discoveryBriefId: "brief-1",
  idempotencyKey: "request-1",
  traceId: "trace-1",
  attempt: 1,
  maxAttempts: 3,
  createdAt: now,
  updatedAt: now,
  state: "LEASED",
  lease: { owner: "worker-1", token: "lease-1", expiresAt: "2026-10-05T10:01:00.000Z" },
};

function fakeRepository(overrides: Partial<JobRepository> = {}) {
  const repo: JobRepository = {
    leaseNextJob: vi.fn().mockResolvedValueOnce(lease).mockResolvedValue(null),
    getMarketProfile: vi.fn().mockResolvedValue(discoveryProfile),
    isCancelled: vi.fn().mockResolvedValue(false),
    heartbeat: vi.fn().mockResolvedValue(true),
    checkpoint: vi.fn().mockResolvedValue(true),
    recordStepAttempt: vi.fn().mockResolvedValue("step-1"),
    retry: vi.fn().mockResolvedValue(true),
    complete: vi.fn().mockResolvedValue(true),
    ...overrides,
  };
  return repo;
}

async function waitFor(assertion: () => void) {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    try { assertion(); return; } catch { await new Promise(resolve => setTimeout(resolve, 5)); }
  }
  assertion();
}

describe("durable job worker", () => {
  it("polls independently, runs no legacy pipeline and completes with the exact lease", async () => {
    const repository = fakeRepository();
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      heartbeatIntervalMs: 1_000,
      handler: async () => ({ state: "COMPLETED", result: { opportunityIds: [] } }),
    });

    worker.start();
    await waitFor(() => expect(repository.complete).toHaveBeenCalledWith(expect.objectContaining({
      jobId: "job-1", workerId: "worker-1", leaseToken: "lease-1",
    }), "COMPLETED", { opportunityIds: [] }, null));
    await worker.shutdown();

    expect(repository.leaseNextJob).toHaveBeenCalled();
    expect(repository.heartbeat).toHaveBeenCalled();
  });

  it("routes an authorized injected operation through its per-provider concurrency hook", async () => {
    const repository = fakeRepository();
    const provider = { id: "fixture-only" };
    const gateCalls: Array<{ capability: string; provider: unknown }> = [];
    const gate: ProviderConcurrencyHook = async ({ capability, provider, execute }) => {
      gateCalls.push({ capability, provider });
      return execute();
    };
    const operation = vi.fn().mockResolvedValue("fixture-result");
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      providerConcurrency: gate,
      handler: async (_job, execution) => {
        const result = await execution.runExternalOperation("SOURCE_SEARCH", () => provider, operation);
        return { state: "COMPLETED", result: { value: result } };
      },
    });

    worker.start();
    await waitFor(() => expect(repository.complete).toHaveBeenCalled());
    await worker.shutdown();

    expect(gateCalls).toEqual([{ capability: "SOURCE_SEARCH", provider }]);
    expect(operation).toHaveBeenCalledExactlyOnceWith(provider, expect.any(AbortSignal));
    expect(repository.complete).toHaveBeenCalledWith(expect.anything(), "COMPLETED", { value: "fixture-result" }, null);
  });

  it("denies a profile-disabled discovery capability before provider selection or operation", async () => {
    const repository = fakeRepository();
    const selectProvider = vi.fn().mockReturnValue("provider");
    const operation = vi.fn();
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      handler: async (_job, execution) => {
        await execution.runExternalOperation("WEB_FETCH", selectProvider, operation);
        return { state: "COMPLETED", result: {} };
      },
    });

    worker.start();
    await waitFor(() => expect(repository.complete).toHaveBeenCalled());
    await worker.shutdown();

    expect(selectProvider).not.toHaveBeenCalled();
    expect(operation).not.toHaveBeenCalled();
    expect(repository.complete).toHaveBeenCalledWith(expect.anything(), "FAILED", null,
      expect.objectContaining({ code: "POLICY_DENIED", retryable: false }));
  });

  it("does not start a provider operation if cancellation is already recorded", async () => {
    const repository = fakeRepository({ isCancelled: vi.fn().mockResolvedValue(true) });
    const handler = vi.fn().mockResolvedValue({ state: "COMPLETED", result: {} });
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      handler,
    });

    worker.start();
    await waitFor(() => expect(repository.isCancelled).toHaveBeenCalled());
    await worker.shutdown();

    expect(handler).not.toHaveBeenCalled();
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("aborts active external work when cancellation is observed and starts no later step", async () => {
    let cancelled = false;
    const repository = fakeRepository({ isCancelled: vi.fn().mockImplementation(async () => cancelled) });
    const providerStarted = vi.fn();
    const nextStep = vi.fn();
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      cancellationCheckIntervalMs: 5,
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      handler: async (_job, execution) => {
        await execution.runExternalOperation("SOURCE_SEARCH", () => "fixture", (_provider, signal) => {
          providerStarted();
          return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason), { once: true }));
        });
        nextStep();
        return { state: "COMPLETED", result: {} };
      },
    });

    worker.start();
    await waitFor(() => expect(providerStarted).toHaveBeenCalled());
    cancelled = true;
    await waitFor(() => expect(repository.isCancelled).toHaveBeenCalled());
    await waitFor(() => expect(nextStep).not.toHaveBeenCalled());
    await worker.shutdown();

    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("derives a safe default heartbeat for a five-second lease and rejects an unsafe override", async () => {
    const repository = fakeRepository();
    expect(() => createJobWorker({
      repository,
      workerId: "worker-1",
      leaseSeconds: 5,
      heartbeatIntervalMs: 2_000,
    })).toThrow(/heartbeat.*lease/i);
    expect(() => createJobWorker({
      repository,
      workerId: "worker-1",
      leaseSeconds: 5,
      heartbeatIntervalMs: 999,
    })).toThrow(/heartbeat.*lease/i);

    const heartbeatTimes: number[] = [];
    const shortLeaseRepository = fakeRepository({
      heartbeat: vi.fn(async () => {
        heartbeatTimes.push(Date.now());
        return true;
      }),
    });
    let finishHandler!: () => void;
    const handlerFinished = new Promise<void>(resolve => { finishHandler = resolve; });
    const worker = createJobWorker({
      repository: shortLeaseRepository,
      workerId: "worker-1",
      leaseSeconds: 5,
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      handler: async () => {
        await new Promise(resolve => setTimeout(resolve, 1_900));
        finishHandler();
        return { state: "COMPLETED", result: {} };
      },
    });

    worker.start();
    await handlerFinished;
    await waitFor(() => expect(shortLeaseRepository.complete).toHaveBeenCalled());
    await worker.shutdown();

    expect(heartbeatTimes.length).toBeGreaterThanOrEqual(2);
    expect(heartbeatTimes[1] - heartbeatTimes[0]).toBeLessThan(2_500);
  }, 5_000);

  it.each(["CIS_RU", "LOCAL_CUSTOM"] as const)(
    "terminalizes a %s job before invoking its handler or provider selector",
    async id => {
      const nonPilotProfile = MarketProfileSchema.parse({
        ...discoveryProfile,
        id,
        workflow: "DISCOVERY_ONLY",
        jurisdictions: [{ countryCode: "RU", subdivisionCode: null }],
        ...(id === "LOCAL_CUSTOM" ? { category: "technology", geography: "Russia" } : {}),
      });
      const repository = fakeRepository({ getMarketProfile: vi.fn().mockResolvedValue(nonPilotProfile) });
      const handler = vi.fn().mockResolvedValue({ state: "COMPLETED", result: {} });
      const selectProvider = vi.fn().mockReturnValue("provider");
      const worker = createJobWorker({
        repository,
        workerId: "worker-1",
        minPollIntervalMs: 2,
        maxPollIntervalMs: 8,
        handler: async (job, execution) => {
          await execution.runExternalOperation("SOURCE_SEARCH", selectProvider, async () => "unexpected");
          return handler(job, execution);
        },
      });

      worker.start();
      await waitFor(() => expect(repository.complete).toHaveBeenCalled());
      await worker.shutdown();

      expect(handler).not.toHaveBeenCalled();
      expect(selectProvider).not.toHaveBeenCalled();
      expect(repository.complete).toHaveBeenCalledWith(expect.anything(), "FAILED", null,
        expect.objectContaining({ code: "POLICY_DENIED", retryable: false }));
    },
  );

  it.each(["CIS_RU", "LOCAL_CUSTOM"] as const)(
    "rejects a %s job declaration even if its stored MarketProfile resolves to EN_DISCOVERY_ONLY",
    async marketProfileId => {
      const nonPilotJob = { ...lease, marketProfileId };
      const repository = fakeRepository({
        leaseNextJob: vi.fn().mockResolvedValueOnce(nonPilotJob).mockResolvedValue(null),
      });
      const handler = vi.fn().mockResolvedValue({ state: "COMPLETED", result: {} });
      const worker = createJobWorker({
        repository,
        workerId: "worker-1",
        minPollIntervalMs: 2,
        maxPollIntervalMs: 8,
        handler,
      });

      worker.start();
      await waitFor(() => expect(repository.complete).toHaveBeenCalled());
      await worker.shutdown();

      expect(handler).not.toHaveBeenCalled();
      expect(repository.complete).toHaveBeenCalledWith(expect.anything(), "FAILED", null,
        expect.objectContaining({ code: "POLICY_DENIED", retryable: false }));
    },
  );

  it("does not complete or mutate a job when an injected operation resolves after cancellation", async () => {
    let cancelled = false;
    let resolveLate!: (value: string) => void;
    let releaseProviderStarted!: () => void;
    let releaseHandlerReturned!: () => void;
    let observedAbort!: () => void;
    const providerStarted = new Promise<void>(resolve => { releaseProviderStarted = resolve; });
    const handlerReturned = new Promise<void>(resolve => { releaseHandlerReturned = resolve; });
    const abortObserved = new Promise<void>(resolve => { observedAbort = resolve; });
    const repository = fakeRepository({
      isCancelled: vi.fn().mockImplementation(async () => cancelled),
    });
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      cancellationCheckIntervalMs: 5,
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      handler: async (_job, execution) => {
        await execution.runExternalOperation("SOURCE_SEARCH", () => "fixture", (_provider, signal) => {
          releaseProviderStarted();
          signal.addEventListener("abort", () => observedAbort(), { once: true });
          return new Promise<string>(resolve => { resolveLate = resolve; });
        }).catch(() => undefined);
        releaseHandlerReturned();
        return { state: "COMPLETED", result: { value: "late" } };
      },
    });

    worker.start();
    await providerStarted;
    cancelled = true;
    await abortObserved;
    resolveLate("late provider result");
    await handlerReturned;
    await worker.shutdown();

    expect(repository.recordStepAttempt).toHaveBeenCalledTimes(1);
    expect(repository.recordStepAttempt).toHaveBeenCalledWith(expect.objectContaining({ state: "STARTED" }));
    expect(repository.complete).not.toHaveBeenCalled();
  });

  it("stops leasing on shutdown and leaves an interrupted lease recoverable", async () => {
    const repository = fakeRepository();
    const started = vi.fn();
    const worker = createJobWorker({
      repository,
      workerId: "worker-1",
      concurrency: 1,
      minPollIntervalMs: 2,
      maxPollIntervalMs: 8,
      shutdownGraceMs: 100,
      handler: async (_job, execution) => {
        started();
        await new Promise((_resolve, reject) => execution.signal.addEventListener("abort", () => reject(execution.signal.reason), { once: true }));
        return { state: "COMPLETED", result: {} };
      },
    });

    worker.start();
    await waitFor(() => expect(started).toHaveBeenCalled());
    await worker.shutdown();

    expect(repository.leaseNextJob).toHaveBeenCalledTimes(1);
    expect(repository.complete).not.toHaveBeenCalled();
  });
});
