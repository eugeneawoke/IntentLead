import type { MarketProfile } from "../../types/market-profile";

function parseJurisdiction(value: string): { countryCode: string; subdivisionCode: string | null } | null {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}(?:-[A-Z0-9][A-Z0-9-]{0,30})?$/.test(normalized)) return null;
  const separator = normalized.indexOf("-");
  return {
    countryCode: normalized.slice(0, 2),
    subdivisionCode: separator === -1 ? null : normalized.slice(separator + 1),
  };
}

export function isValidJurisdiction(value: string): boolean {
  return parseJurisdiction(value) !== null;
}

function normalizedSubdivision(countryCode: string, subdivisionCode: string | null): string | null {
  if (!subdivisionCode) return null;
  const normalized = subdivisionCode.trim().toUpperCase();
  const prefix = `${countryCode.toUpperCase()}-`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

export function profileAllowsJurisdiction(profile: MarketProfile, requested: string): boolean {
  const parsed = parseJurisdiction(requested);
  if (!parsed) return false;
  return profile.jurisdictions.some(authorized => {
    if (authorized.countryCode !== parsed.countryCode) return false;
    const authorizedSubdivision = normalizedSubdivision(authorized.countryCode, authorized.subdivisionCode);
    return authorizedSubdivision === null || authorizedSubdivision === parsed.subdivisionCode;
  });
}

export function descriptorSupportsJurisdiction(supported: string[], requested: string): boolean {
  if (supported.includes("*")) return true;
  const request = parseJurisdiction(requested);
  if (!request) return false;
  return supported.some(value => {
    const descriptor = parseJurisdiction(value);
    if (!descriptor || descriptor.countryCode !== request.countryCode) return false;
    return descriptor.subdivisionCode === null || descriptor.subdivisionCode === request.subdivisionCode;
  });
}
