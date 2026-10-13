import { describe, expect, it } from "vitest";
import { createJobWorker } from "../../worker/jobs/worker";
import type { JobRepository, LeasedJob } from "../../worker/jobs/repository";
import type { MarketProfile } from "../../types/market-profile";
import { candidateExternalStepKey } from "../../worker/workflows/self-prospecting-helpers";

const profile: MarketProfile = {
  schemaVersion: 1, id: "EN_DISCOVERY_ONLY", workspaceId: "workspace-1", jurisdictions: [], regions: [],
  languages: ["en"], capabilities: ["SOURCE_SEARCH", "COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT", "HUMAN_REVIEW"],
  disabledCapabilities: ["MAILBOX_CONNECT", "MESSAGE_SEND", "SEQUENCE_RUN", "FOLLOW_UP", "DELIVERY_TRACKING"],
  legalPolicyId: "legal-v1", retentionPolicyId: "retention-v1",
  defaultCurrency: "USD", timezone: "UTC", workflow: "DISCOVERY_ONLY",
};

const job: LeasedJob = {
  schemaVersion: 1, id: "job-1", workspaceId: "workspace-1", capability: "SOURCE_SEARCH",
  marketProfileId: "EN_DISCOVERY_ONLY", discoveryBriefId: "brief-1", idempotencyKey: "step-identity",
  traceId: "trace-1", attempt: 2, maxAttempts: 3, createdAt: "2026-10-05T12:00:00Z",
  updatedAt: "2026-10-05T12:00:00Z", state: "LEASED",
  lease: { owner: "worker-1", token: "lease-token", expiresAt: "2026-10-05T12:01:00Z" },
};

describe("candidate-scoped durable external operation steps", () => {
  it("records distinct company and assessment keys for two signals through the worker adapter", async () => {
    const attempts: Array<{ stepKey: string; state: string }> = [];
    let leased = false;
    let finish!: () => void;
    const completed = new Promise<void>(resolve => { finish = resolve; });
    const repository = {
      async leaseNextJob() { if (leased) return null; leased = true; return job; },
      async getMarketProfile() { return profile; },
      async isCancelled() { return false; },
      async heartbeat() { return true; },
      async checkpoint() { return true; },
      async recordStepAttempt(input: { stepKey: string; state: string }) {
        attempts.push({ stepKey: input.stepKey, state: input.state });
        return `step-${attempts.length}`;
      },
      async retry() { return false; },
      async complete() { finish(); return true; },
    } as unknown as JobRepository;
    const worker = createJobWorker({
      repository, workerId: "worker-1", leaseSeconds: 30, minPollIntervalMs: 10,
      maxPollIntervalMs: 10, heartbeatIntervalMs: 1_000,
      handler: async (_job, execution) => {
        for (const candidateKey of ["hackernews:signal-one", "hackernews:signal-two"]) {
          for (const capability of ["COMPANY_RESOLUTION", "OPPORTUNITY_ASSESSMENT"] as const) {
            await execution.runExternalOperation(capability, () => "fixture", async () => true,
              candidateExternalStepKey(capability, candidateKey));
          }
        }
        return { state: "COMPLETED", result: { fixtureOnly: true }, error: null };
      },
    });

    worker.start();
    await completed;
    await worker.shutdown();

    const starts = attempts.filter(attempt => attempt.state === "STARTED");
    expect(starts).toHaveLength(4);
    expect(new Set(starts.map(attempt => attempt.stepKey)).size).toBe(4);
    expect(attempts).toHaveLength(8);
    expect(attempts.filter(attempt => attempt.state === "COMPLETED")).toHaveLength(4);
  });
});
