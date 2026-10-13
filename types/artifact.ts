import type { z } from "zod";
import type { ArtifactMetadataSchema } from "../lib/domain/schemas/governance";

export type ArtifactMetadata = z.infer<typeof ArtifactMetadataSchema>;
