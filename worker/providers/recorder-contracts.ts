import type { MarketProfile } from "../../types/market-profile";
import type { ProviderCapability, ProviderCost, ProviderFailureKind, ProviderId, ProviderRunStatus, ProviderUsage } from "./contracts";
import type { CapabilityError } from "../../types/job";

export interface ProviderRunStart {
  providerRunId: string;
  capability: ProviderCapability;
  provider: ProviderId;
  providerVersion: string;
  startedAt: string;
  requestMetadata: {
    marketProfileId: MarketProfile["id"];
    traceId: string;
    inputCount: number;
    inputHash: string | null;
  };
}

export interface ProviderRunFinish {
  providerRunId: string;
  status: Exclude<ProviderRunStatus, "STARTED">;
  finishedAt: string;
  latencyMs: number;
  usage: ProviderUsage;
  cost: ProviderCost;
  responseMetadata: {
    recordCount: number;
    failureKind: ProviderFailureKind | null;
    errorCode: CapabilityError["code"] | null;
  };
}

/** A narrow audit seam; implementations may call the lease-bound Task 4 RPC, never generic table writes. */
export interface ProviderRunRecorder {
  start(input: ProviderRunStart): Promise<void>;
  finish(input: ProviderRunFinish): Promise<void>;
}
