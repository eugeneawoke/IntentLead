import { z } from "zod";
import { DiscoveryBriefSummarySchema } from "@/lib/domain/schemas/market-profile";
import type { CreateDiscoveryBriefInput } from "@/lib/application/discovery-briefs";
import type { DiscoveryBriefSummary } from "@/types/discovery-brief";

const CreatedSchema = z.object({
  discoveryBriefId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  offerProfileId: z.string().uuid(),
  icpDefinitionId: z.string().uuid(),
  marketProfileId: z.string().uuid(),
  created: z.boolean(),
}).strict();

const RunSchema = z.object({ jobId: z.string().uuid(), status: z.literal("queued") }).strict();

export class DiscoveryApiError extends Error {
  constructor(message = "Could not complete the discovery request. Try again.") {
    super(message);
    this.name = "DiscoveryApiError";
  }
}

async function data(response: Response): Promise<unknown> {
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object" || !("data" in payload)) {
    throw new DiscoveryApiError();
  }
  return payload.data;
}

export async function loadDiscoveryBriefs(): Promise<DiscoveryBriefSummary[]> {
  const payload = await data(await fetch("/api/discovery-briefs", { cache: "no-store" }));
  const parsed = z.object({ discoveryBriefs: z.array(DiscoveryBriefSummarySchema) }).strict().safeParse(payload);
  if (!parsed.success) throw new DiscoveryApiError("Discovery response was invalid.");
  return parsed.data.discoveryBriefs;
}

export async function discoveryCreateIdempotencyKey(input: CreateDiscoveryBriefInput): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(input));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  return `discovery-ui-v1:${fingerprint}`;
}

export async function createDiscoveryBrief(input: CreateDiscoveryBriefInput) {
  const idempotencyKey = await discoveryCreateIdempotencyKey(input);
  const payload = await data(await fetch("/api/discovery-briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
    body: JSON.stringify(input),
  }));
  const parsed = z.object({ discoveryBrief: CreatedSchema }).strict().safeParse(payload);
  if (!parsed.success) throw new DiscoveryApiError("Discovery response was invalid.");
  return parsed.data.discoveryBrief;
}

export async function runDiscoveryBrief(id: string) {
  const payload = await data(await fetch(`/api/discovery-briefs/${encodeURIComponent(id)}/run`, {
    method: "POST",
    headers: { "Idempotency-Key": `discovery-run-${id}` },
  }));
  const parsed = RunSchema.safeParse(payload);
  if (!parsed.success) throw new DiscoveryApiError("Discovery run response was invalid.");
  return parsed.data;
}
