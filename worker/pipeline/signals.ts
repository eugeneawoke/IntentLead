import type { Campaign } from "../../types/campaign";
import type { CreateSignalInput } from "../../types/signal";
import { legacyProviderBridge } from "../providers/legacy";

export async function fetchSignals(campaign: Campaign): Promise<CreateSignalInput[]> {
  return legacyProviderBridge.fetchSignals(campaign);
}
