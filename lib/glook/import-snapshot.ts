import { createHash } from "node:crypto";
import { ApplicationError } from "@/lib/application/errors";
import type { ApplicationContext } from "@/lib/application/context";
import { EvidenceItemSchema, SourceItemSchema } from "@/lib/domain/schemas/evidence";
import { SiteContextSnapshotSchema } from "@/lib/domain/schemas/glook-site-context-snapshot";
import type { EvidenceItem } from "@/types/evidence";
import type { SourceItem } from "@/types/source-item";
import type { GlookSnapshotSiteUrlUse, SiteContextSnapshot } from "@/types/glook-site-context-snapshot";

export type GlookSnapshotEvidenceClass = "GENERATED_INTERPRETATION";
export type GlookSnapshotEvidenceField =
  | "detectedService" | "targetAudience" | "businessProfile" | "aiSummary" | "topPriority";

export interface GlookSnapshotEvidenceProjection {
  classification: GlookSnapshotEvidenceClass;
  field: GlookSnapshotEvidenceField;
  trustBoundary: "UNTRUSTED_CONTENT";
  evidence: EvidenceItem;
}

export interface GlookSnapshotImportRecord {
  snapshotId: string;
  idempotencyKey: string;
  contentDigest: string;
  siteUrlUse: GlookSnapshotSiteUrlUse;
  sourceItem: SourceItem;
  evidenceItems: GlookSnapshotEvidenceProjection[];
}

export class GlookSnapshotIdentityConflictError extends Error {
  constructor() {
    super("Snapshot identity was previously used for different content");
    this.name = "GlookSnapshotIdentityConflictError";
  }
}

export class GlookSnapshotExpiredImportError extends Error {
  constructor() {
    super("Expired snapshot has not been imported before");
    this.name = "GlookSnapshotExpiredImportError";
  }
}

export interface GlookSnapshotImportRepository {
  /** Atomically per workspace return exact prior imports, conflict on changed content, or create only when allowed. */
  persistIdempotently(record: GlookSnapshotImportRecord, allowCreate: boolean): Promise<GlookSnapshotImportRecord>;
}

export interface GlookSnapshotImportDependencies {
  repository: GlookSnapshotImportRepository;
  now?: () => Date;
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function deterministicId(prefix: string, identity: string): string {
  return `${prefix}-${sha256(identity).slice(0, 32)}`;
}

function normalizedSourceContent(snapshot: ActiveSiteContextSnapshot): string {
  return JSON.stringify({
    source: "GLOOK_SITE_CONTEXT_SNAPSHOT_V1",
    siteUrl: snapshot.siteUrl,
    businessContext: snapshot.businessContext,
    interpretation: snapshot.interpretation,
  });
}

function evidenceRows(snapshot: SiteContextSnapshot): Array<{
  classification: GlookSnapshotEvidenceClass;
  field: GlookSnapshotEvidenceField;
  value: string;
}> {
  if (snapshot.redactionState === "REDACTED") return [];
  const facts = snapshot.businessContext;
  const interpretations = snapshot.interpretation;
  const rows: Array<{ classification: GlookSnapshotEvidenceClass; field: GlookSnapshotEvidenceField; value: string }> = [];
  for (const field of ["detectedService", "targetAudience", "businessProfile"] as const) {
    const value = facts[field];
    if (value !== null) rows.push({ classification: "GENERATED_INTERPRETATION", field, value });
  }
  if (interpretations.aiSummary !== null) {
    rows.push({ classification: "GENERATED_INTERPRETATION", field: "aiSummary", value: interpretations.aiSummary });
  }
  interpretations.topPriorities.forEach(value => rows.push({
    classification: "GENERATED_INTERPRETATION", field: "topPriority", value,
  }));
  return rows;
}

type ActiveSiteContextSnapshot = Extract<SiteContextSnapshot, { redactionState: "ACTIVE" }>;

function projectImport(context: ApplicationContext, snapshot: ActiveSiteContextSnapshot): GlookSnapshotImportRecord {
  const workspaceId = context.workspace.id;
  const sourceItemId = deterministicId("glook-source", `${workspaceId}:${snapshot.idempotencyKey}`);
  const sourceContent = normalizedSourceContent(snapshot);
  const provenance = {
    sourceType: "WEB" as const,
    sourceId: snapshot.snapshotId,
    providerRunId: null,
    rawArtifactId: null,
  };
  const sourceResult = SourceItemSchema.safeParse({
    schemaVersion: 1,
    id: sourceItemId,
    workspaceId,
    externalId: snapshot.idempotencyKey,
    sourceUrl: snapshot.siteUrl,
    capturedAt: snapshot.scanCompletedAt,
    publishedAt: null,
    contentHash: sha256(sourceContent),
    content: sourceContent,
    structuredFacts: {},
    provenance,
    jurisdiction: null,
  });
  if (!sourceResult.success) throw new ApplicationError("INTERNAL_ERROR", "Glook source projection is invalid");

  const evidenceItems = evidenceRows(snapshot).map((row, index) => {
    const evidenceId = deterministicId("glook-evidence", `${workspaceId}:${snapshot.snapshotId}:${row.classification}:${row.field}:${index}`);
    const evidenceResult = EvidenceItemSchema.safeParse({
      schemaVersion: 1,
      id: evidenceId,
      workspaceId,
      sourceItemId,
      type: "text",
      sourceUrl: snapshot.siteUrl,
      capturedAt: snapshot.scanCompletedAt,
      excerpt: row.value,
      structuredFacts: {},
      verificationMethod: "glook_untrusted_generated_interpretation",
      confidence: 0,
      contentHash: sha256(row.value),
      provenance,
      jurisdiction: null,
    });
    if (!evidenceResult.success) throw new ApplicationError("INTERNAL_ERROR", "Glook evidence projection is invalid");
    return {
      classification: row.classification,
      field: row.field,
      trustBoundary: "UNTRUSTED_CONTENT" as const,
      evidence: evidenceResult.data,
    };
  });

  return {
    snapshotId: snapshot.snapshotId,
    idempotencyKey: snapshot.idempotencyKey,
    contentDigest: snapshot.producerContentDigest,
    siteUrlUse: "CANONICAL_IDENTIFIER_ONLY_NO_FETCH_AUTHORIZATION",
    sourceItem: sourceResult.data,
    evidenceItems,
  };
}

export async function importGlookSiteContextSnapshot(
  context: ApplicationContext,
  rawSnapshot: unknown,
  dependencies: GlookSnapshotImportDependencies,
): Promise<GlookSnapshotImportRecord> {
  if (!context.authenticatedUserId || !context.workspace.id || context.workspace.role !== "OWNER"
    || context.marketProfile.workspaceId !== context.workspace.id) {
    throw new ApplicationError("NOT_FOUND", "Glook snapshot import context is not available");
  }
  if (context.marketProfile.id !== "EN_DISCOVERY_ONLY" || context.marketProfile.workflow !== "DISCOVERY_ONLY") {
    throw new ApplicationError("POLICY_DENIED", "Glook snapshot import is limited to discovery-only workspaces");
  }

  const parsed = SiteContextSnapshotSchema.safeParse(rawSnapshot);
  if (!parsed.success) throw new ApplicationError("INVALID_INPUT", "Glook snapshot is invalid");
  const snapshot = parsed.data;
  if (snapshot.subjectUserId !== context.authenticatedUserId) {
    throw new ApplicationError("NOT_FOUND", "Glook snapshot not found");
  }
  if (snapshot.redactionState === "REDACTED") {
    throw new ApplicationError("INVALID_INPUT", "Redacted Glook snapshots cannot be imported");
  }
  const now = (dependencies.now ?? (() => new Date()))().getTime();
  if (!Number.isFinite(now) || now < Date.parse(snapshot.issuedAt)) {
    throw new ApplicationError("INVALID_INPUT", "Glook snapshot is outside its validity window");
  }

  const record = projectImport(context, snapshot);
  const allowCreate = now < Date.parse(snapshot.expiresAt);
  try {
    return await dependencies.repository.persistIdempotently(record, allowCreate);
  } catch (error) {
    if (error instanceof GlookSnapshotIdentityConflictError) {
      throw new ApplicationError("CONFLICT", "Glook snapshot identity conflicts with a prior import");
    }
    if (error instanceof GlookSnapshotExpiredImportError) {
      throw new ApplicationError("INVALID_INPUT", "Glook snapshot is expired and has not been imported previously");
    }
    throw new ApplicationError("INTERNAL_ERROR", "Glook snapshot could not be imported", { cause: error });
  }
}
