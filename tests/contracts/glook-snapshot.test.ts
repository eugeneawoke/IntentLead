import { describe, expect, it } from "vitest";
import { SiteContextSnapshotSchema } from "../../lib/domain/schemas/glook-site-context-snapshot";
import {
  digestMismatchSnapshot,
  invalidRedactedSnapshot,
  malformedChronologySnapshot,
  unsafeUrlSnapshot,
  unknownVersionSnapshot,
  validActiveSnapshot,
  validRedactedSnapshot,
} from "./fixtures/glook-snapshot-v1";

describe("Glook SiteContextSnapshot v1 contract", () => {
  it("parses frozen active and fully redacted snapshots", () => {
    expect(SiteContextSnapshotSchema.parse(validActiveSnapshot)).toEqual(validActiveSnapshot);
    expect(SiteContextSnapshotSchema.parse(validRedactedSnapshot)).toEqual(validRedactedSnapshot);
  });

  it("rejects unknown versions and fields", () => {
    expect(SiteContextSnapshotSchema.safeParse(unknownVersionSnapshot).success).toBe(false);
    expect(SiteContextSnapshotSchema.safeParse({ ...validActiveSnapshot, providerPayload: { raw: true } }).success).toBe(false);
  });

  it("rejects unsafe, ambiguous, or non-canonical site URLs", () => {
    for (const siteUrl of [
      "http://example.com/",
      "https://user:pass@example.com/",
      "https://example.com/?token=secret",
      "https://example.com/#fragment",
      "https://localhost/",
      "https://example.local/",
      "https://service.intranet/",
      "https://router.home.arpa/",
      "https://192.168.1.4/",
      "https://example.com:8443/",
      "https://xn--e1afmkfd.example/",
      "https://example..com/",
      "https://example.com/path/../admin",
    ]) {
      expect(SiteContextSnapshotSchema.safeParse({ ...validActiveSnapshot, siteUrl }).success).toBe(false);
    }
    const unsafeUrlResult = SiteContextSnapshotSchema.safeParse(unsafeUrlSnapshot);
    expect(unsafeUrlResult.success).toBe(false);
    if (!unsafeUrlResult.success) {
      expect(unsafeUrlResult.error.issues.some(issue => issue.path[0] === "siteUrl")).toBe(true);
    }
  });

  it("rejects impossible timestamps and mismatched content digests", () => {
    expect(SiteContextSnapshotSchema.safeParse(malformedChronologySnapshot).success).toBe(false);
    expect(SiteContextSnapshotSchema.safeParse({ ...validActiveSnapshot, scanCompletedAt: "not-a-time" }).success).toBe(false);
    expect(SiteContextSnapshotSchema.safeParse({ ...validActiveSnapshot, expiresAt: validActiveSnapshot.issuedAt }).success).toBe(false);
    expect(SiteContextSnapshotSchema.safeParse(digestMismatchSnapshot).success).toBe(false);
  });

  it("requires redacted snapshots to contain no source or interpretation content", () => {
    expect(SiteContextSnapshotSchema.safeParse(invalidRedactedSnapshot).success).toBe(false);
  });

  it("bounds interpretation text and priority count", () => {
    expect(SiteContextSnapshotSchema.safeParse({
      ...validActiveSnapshot,
      interpretation: { ...validActiveSnapshot.interpretation, topPriorities: ["1", "2", "3", "4"] },
    }).success).toBe(false);
    expect(SiteContextSnapshotSchema.safeParse({
      ...validActiveSnapshot,
      businessContext: { ...validActiveSnapshot.businessContext, businessProfile: "x".repeat(1201) },
    }).success).toBe(false);
  });
});
