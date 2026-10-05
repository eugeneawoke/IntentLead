import { describe, expect, it } from "vitest";
import { normalizeCompanyRootDomain, normalizePublicSignalText, sanitizeCompanySignal } from "../../worker/providers/normalization";

describe("provider normalization", () => {
  it.each([
    ["https://www.media.co.il/", "media.co.il"],
    ["https://www.division.acme.com.au/about", "acme.com.au"],
    ["dept.eu.acme.example.com", "example.com"],
    ["https://BÜCHER.de/unternehmen", "xn--bcher-kva.de"],
  ])("normalizes PSL-aware company root %s", (input, expected) => {
    expect(normalizeCompanyRootDomain(input)).toBe(expected);
  });

  it.each([
    "co.il",
    "com.au",
    "acme.test",
    "localhost",
    "127.0.0.1",
    "https://[2001:db8::1]/",
    "not a valid domain",
    "invalid..example.com",
  ])("rejects non-registrable company domain %s", input => {
    expect(normalizeCompanyRootDomain(input)).toBeNull();
  });

  it("removes contact-like PII and URLs while preserving company-relevant text", () => {
    const input = "Acme hiring for customer intake. Call +1 (415) 555-0199 or 020 7946 0958; email Jane@example.test, message @jane_ops, see https://acme.test/about.";
    const publicText = normalizePublicSignalText(input, 1_000);
    const searchText = sanitizeCompanySignal(input, 1_000);

    for (const text of [publicText, searchText]) {
      expect(text).toContain("Acme hiring for customer intake");
      expect(text).not.toMatch(/415|7946|Jane@example\.test|@jane_ops|https:\/\//i);
    }
  });
});
