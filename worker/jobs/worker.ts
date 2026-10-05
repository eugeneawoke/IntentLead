import { CapabilityErrorSchema } from "../../lib/domain/schemas/job";
import { DiscoveryCapabilitySchema } from "../../lib/domain/schemas/common";
import type { Capability, MarketProfile } from "../../types/market-profile";
import type { CapabilityError } from "../../types/job";
import type { JobRepository, LeasedJob, LeaseIdentity } from "./repository";

export interface ExternalOperationExecution {
  runExternalOperation<TProvider, TResult>(
    capability: Capability,
    selectProvider: () => TProvider,
    operation: (provider: TProvider, signal: AbortSignal) => Promise<TResult>,
  ): Promise<TResult>;
  checkpoint(checkpoint: Record<string, unknown>): Promise<void>;
  signal: AbortSignal;
}

export type JobHandlerResult =
  | { state: "COMPLETED"; result: Record<string, unknown>; error?: null }
  | { state: "PARTIAL"; result: Record<string, unknown>; error: CapabilityError };

export type JobHandler = (job: LeasedJob, execution: ExternalOperationExecution) => Promise<JobHandlerResult>;
export type ProviderConcurrencyHook = <TProvider, TResult>(input: {
  capability: Capability;
  provider: TProvider;
  signal: AbortSignal;
  execute: () => Promise<TResult>;
}) => Promise<TResult>;

export interface JobWorkerOptions {
  repository: JobRepository;
  workerId: string;
  handler?: JobHandler;
  providerConcurrency?: ProviderConcurrencyHook;
  concurrency?: number;
  leaseSeconds?: number;
  minPollIntervalMs?: number;
  maxPollIntervalMs?: number;
  heartbeatIntervalMs?: number;
  cancellationCheckIntervalMs?: number;
  shutdownGraceMs?: number;
  random?: () => number;
}

class JobCancelledError extends Error {}
class LeaseLostError extends Error {}

function structuredError(job: LeasedJob, capability: Capability, code: CapabilityError["code"], message: string): CapabilityError {
  return code === "TIMEOUT" || code === "RATE_LIMITED" || code === "DEPENDENCY_UNAVAILABLE"
    ? { schemaVersion: 1, message, capability, traceId: job.traceId, code, retryable: true, retryAfterMs: null }
    : { schemaVersion: 1, message, capability, traceId: job.traceId, code, retryable: false, retryAfterMs: null };
}

function assertCapabilityAllowed(profile: MarketProfile, capability: Capability, job: LeasedJob): void {
  const enabled = (profile.capabilities as readonly Capability[]).includes(capability)
    && !(profile.disabledCapabilities as readonly Capability[]).includes(capability);
  const discoveryDenied = profile.id === "EN_DISCOVERY_ONLY"
    && (!DiscoveryCapabilitySchema.safeParse(capability).success || profile.workflow !== "DISCOVERY_ONLY");
  if (!enabled || discoveryDenied) {
    throw new PolicyError(structuredError(job, capability, "POLICY_DENIED", "Capability is disabled by the authorized MarketProfile"));
  }
}

class PolicyError extends Error {
  constructor(readonly capabilityError: CapabilityError) { super(capabilityError.message); }
}

function toCapabilityError(error: unknown, job: LeasedJob): CapabilityError {
  if (error instanceof PolicyError) return error.capabilityError;
  const parsed = CapabilityErrorSchema.safeParse(error);
  if (parsed.success) return parsed.data;
  return structuredError(job, job.capability, "INTERNAL_ERROR", "Discovery job failed");
}

function defaultHandler(job: LeasedJob): Promise<JobHandlerResult> {
  return Promise.reject(structuredError(
    job,
    job.capability,
    "CAPABILITY_UNAVAILABLE",
    "No discovery operation is configured for this worker",
  ));
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function resolveHeartbeatIntervalMs(leaseSeconds: number, configuredIntervalMs?: number): number {
  const maxSafeIntervalMs = Math.floor(leaseSeconds * 1_000 / 3);
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 5 || leaseSeconds > 3_600
    || (configuredIntervalMs !== undefined
      && (!Number.isInteger(configuredIntervalMs) || configuredIntervalMs < 1_000))) {
    throw new Error("Invalid worker heartbeat/lease configuration");
  }
  const intervalMs = configuredIntervalMs ?? maxSafeIntervalMs;
  if (intervalMs > maxSafeIntervalMs) {
    throw new Error("Worker heartbeat interval must be no more than one third of the lease duration");
  }
  return intervalMs;
}

export function createJobWorker(options: JobWorkerOptions) {
  const repository = options.repository;
  const workerId = options.workerId.trim();
  if (!workerId) throw new Error("workerId is required");
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 2, 32));
  const leaseSeconds = Math.max(5, Math.min(options.leaseSeconds ?? 60, 3600));
  const minPollIntervalMs = Math.max(10, options.minPollIntervalMs ?? 250);
  const maxPollIntervalMs = Math.max(minPollIntervalMs, options.maxPollIntervalMs ?? 5_000);
  const heartbeatIntervalMs = resolveHeartbeatIntervalMs(leaseSeconds, options.heartbeatIntervalMs);
  const cancellationCheckIntervalMs = Math.max(100, options.cancellationCheckIntervalMs ?? 1_000);
  const random = options.random ?? Math.random;
  const handler = options.handler ?? defaultHandler;
  const providerConcurrency = options.providerConcurrency ?? (async ({ execute }) => execute());
  const active = new Map<string, AbortController>();
  let running = false;
  let loop: Promise<void> | undefined;
  let wakeResolver: (() => void) | null = null;
  let shutDown = false;

  function wake(): void {
    const resolve = wakeResolver;
    wakeResolver = null;
    resolve?.();
  }

  async function waitForWork(milliseconds: number): Promise<void> {
    await new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timer);
        if (wakeResolver === finish) wakeResolver = null;
        resolve();
      };
      const timer = setTimeout(finish, milliseconds);
      wakeResolver = finish;
    });
  }

  function log(level: string, job: LeasedJob, code: string, message: string): void {
    process.stdout.write(`${JSON.stringify({ level, jobId: job.id, traceId: job.traceId, attempt: job.attempt, code, msg: message })}\n`);
  }

  async function runJob(job: LeasedJob): Promise<void> {
    if (shutDown) return;
    const lease: LeaseIdentity = { jobId: job.id, workerId, leaseToken: job.lease.token };
    const controller = new AbortController();
    active.set(job.id, controller);
    let cancellationTimer: ReturnType<typeof setInterval> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
    try {
      const profile = await repository.getMarketProfile(job);
      if (await repository.isCancelled(job.id)) return;
      if (job.marketProfileId !== "EN_DISCOVERY_ONLY"
        || profile.id !== "EN_DISCOVERY_ONLY" || profile.workflow !== "DISCOVERY_ONLY") {
        throw new PolicyError(structuredError(
          job,
          job.capability,
          "POLICY_DENIED",
          "Only EN_DISCOVERY_ONLY discovery is enabled for this worker",
        ));
      }
      if (!await repository.heartbeat(lease, leaseSeconds)) throw new LeaseLostError();

      const pollCancellation = async () => {
        try {
          if (await repository.isCancelled(job.id) && !controller.signal.aborted) {
            controller.abort(new JobCancelledError("Job cancellation was requested"));
            log("info", job, "JOB_CANCELLED", "Cancellation observed; active operation aborted");
          }
        } catch {
          if (!controller.signal.aborted) controller.abort(new Error("Could not confirm cancellation state"));
        }
      };
      cancellationTimer = setInterval(() => { void pollCancellation(); }, cancellationCheckIntervalMs);
      heartbeatTimer = setInterval(() => {
        void repository.heartbeat(lease, leaseSeconds).then(ok => {
          if (!ok && !controller.signal.aborted) controller.abort(new LeaseLostError());
        }).catch(() => {
          if (!controller.signal.aborted) controller.abort(new LeaseLostError());
        });
      }, heartbeatIntervalMs);

      const execution: ExternalOperationExecution = {
        signal: controller.signal,
        async checkpoint(checkpoint) {
          if (controller.signal.aborted) throw controller.signal.reason;
          if (await repository.isCancelled(job.id)) {
            controller.abort(new JobCancelledError("Job cancellation was requested"));
            throw controller.signal.reason;
          }
          if (!await repository.checkpoint(lease, checkpoint)) throw new LeaseLostError();
        },
        async runExternalOperation(capability, selectProvider, operation) {
          if (controller.signal.aborted) throw controller.signal.reason;
          if (await repository.isCancelled(job.id)) {
            controller.abort(new JobCancelledError("Job cancellation was requested"));
            throw controller.signal.reason;
          }
          assertCapabilityAllowed(profile, capability, job);
          const stepKey = capability.toLowerCase();
          const recorded = await repository.recordStepAttempt({
            ...lease, stepKey, attempt: job.attempt, state: "STARTED", checkpoint: {},
          });
          if (!recorded) throw new LeaseLostError();
          let result: Awaited<ReturnType<typeof operation>>;
          try {
            const provider = selectProvider();
            if (controller.signal.aborted) throw controller.signal.reason;
            let operationStarted = false;
            result = await providerConcurrency({
              capability,
              provider,
              signal: controller.signal,
              execute: async () => {
                if (operationStarted) throw new Error("Provider concurrency hook executed an operation more than once");
                operationStarted = true;
                if (controller.signal.aborted) throw controller.signal.reason;
                return operation(provider, controller.signal);
              },
            });
            if (!operationStarted) throw new Error("Provider concurrency hook did not execute its operation");
          } catch (error) {
            const mapped = toCapabilityError(error, job);
            try {
              await repository.recordStepAttempt({
                ...lease, stepKey, attempt: job.attempt,
                state: mapped.retryable ? "RETRYABLE_FAILED" : "PERMANENT_FAILED",
                retryReason: mapped.code, checkpoint: {},
              });
            } catch { /* lease may already be revoked by cancellation */ }
            throw error;
          }
          if (controller.signal.aborted) throw controller.signal.reason;
          if (!await repository.recordStepAttempt({
            ...lease, stepKey, attempt: job.attempt, state: "COMPLETED", checkpoint: {},
          })) throw new LeaseLostError();
          return result;
        },
      };

      const result = await handler(job, execution);
      if (controller.signal.aborted || shutDown || await repository.isCancelled(job.id)) return;
      const resultError = result.error ?? null;
      if (!await repository.complete(lease, result.state, result.result, resultError)) {
        log("warn", job, "LEASE_COMPLETION_REJECTED", "Job completion was rejected by the lease repository");
      }
    } catch (error) {
      if (error instanceof JobCancelledError || error instanceof LeaseLostError || controller.signal.aborted || shutDown) return;
      const mapped = toCapabilityError(error, job);
      if (mapped.retryable && job.attempt < job.maxAttempts) {
        const availableAt = new Date(Date.now() + (mapped.retryAfterMs ?? minPollIntervalMs)).toISOString();
        if (await repository.retry(lease, mapped, availableAt)) {
          log("warn", job, mapped.code, "Job scheduled for retry");
        } else {
          log("warn", job, "LEASE_RETRY_REJECTED", "Retry was rejected by the lease repository");
        }
      } else {
        await repository.complete(lease, "FAILED", null, mapped);
        log("error", job, mapped.code, "Job ended without a result");
      }
    } finally {
      if (cancellationTimer) clearInterval(cancellationTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      active.delete(job.id);
      wake();
    }
  }

  async function poll(): Promise<void> {
    let delay = minPollIntervalMs;
    while (running) {
      let leasedAny = false;
      try {
        while (running && active.size < concurrency) {
          const job = await repository.leaseNextJob(workerId, leaseSeconds);
          if (!job) break;
          leasedAny = true;
          void runJob(job).catch(() => {
            log("error", job, "WORKER_JOB_UNEXPECTED", "Worker task failed unexpectedly");
          });
        }
      } catch {
        process.stdout.write(`${JSON.stringify({ level: "error", workerId, code: "POLL_FAILED", msg: "Durable job polling failed" })}\n`);
      }
      if (leasedAny) delay = minPollIntervalMs;
      else delay = Math.min(maxPollIntervalMs, Math.max(minPollIntervalMs, Math.round(delay * 1.7)));
      const jittered = Math.max(minPollIntervalMs, Math.round(delay * (0.7 + random() * 0.6)));
      await waitForWork(jittered);
    }
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      shutDown = false;
      loop = poll();
    },
    wake,
    async shutdown(): Promise<void> {
      shutDown = true;
      running = false;
      wake();
      for (const controller of active.values()) {
        if (!controller.signal.aborted) controller.abort(new JobCancelledError("Worker is shutting down"));
      }
      await loop;
      const settle = Promise.allSettled(Array.from(active.keys()).map(async jobId => {
        while (active.has(jobId)) await sleep(5);
      }));
      await Promise.race([settle, sleep(options.shutdownGraceMs ?? 5_000)]);
    },
  };
}
