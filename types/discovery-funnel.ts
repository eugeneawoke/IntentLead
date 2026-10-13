import type { z } from "zod";
import type { DiscoveryFunnelMetricsSchema } from "../lib/domain/schemas/discovery-funnel";

export type DiscoveryFunnelMetrics = z.infer<typeof DiscoveryFunnelMetricsSchema>;
