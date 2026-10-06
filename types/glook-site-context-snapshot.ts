import type { z } from "zod";
import type {
  SiteContextSnapshotBodySchema,
  SiteContextSnapshotSchema,
} from "../lib/domain/schemas/glook-site-context-snapshot";

export type SiteContextSnapshot = z.infer<typeof SiteContextSnapshotSchema>;
export type SiteContextSnapshotBody = z.infer<typeof SiteContextSnapshotBodySchema>;
export type GlookSnapshotSiteUrlUse = "CANONICAL_IDENTIFIER_ONLY_NO_FETCH_AUTHORIZATION";
