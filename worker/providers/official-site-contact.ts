import { ContactDiscoveryCandidateSchema, EmailFindInputSchema } from "../../lib/domain/schemas/provider-research";
import type {
  ContactDiscoveryCandidate, EmailFindInput, EmailFindProvider,
} from "../../types/provider-research";
import type { CapabilityError } from "../../types/job";
import {
  ProviderCancelledError,
  type ProviderCallContext,
  type ProviderDescriptor,
  type ProviderFailureKind,
  type ProviderRuntimeDependencies,
  type ProviderResult,
} from "./contracts";
import { ProviderHttpError, ProviderMalformedResponseError } from "./http";
import { normalizeCompanyRootDomain, normalizeHttpUrl, stableProviderSourceId } from "./normalization";
import { mapProviderFailure, runRecordedProvider, type ProviderOperationResult } from "./results";

const ROLE_LOCAL_PARTS = new Set([
  "business", "contact", "hello", "info", "office", "partners", "partnerships", "sales", "support", "team",
]);
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const DEFAULT_PATHS = ["/", "/contact", "/about"] as const;

export interface OfficialSiteEgress {
  /** Owns request authorization, DNS/private-address enforcement, redirects and response-size bounds. */
  fetchText(input: {
    sourceUrl: string;
    expectedRootDomain: string;
    init: RequestInit;
    maxResponseBytes: number;
    signal: AbortSignal;
  }): Promise<string>;
}

export function createOfficialSiteContactProvider(config: {
  descriptor: ProviderDescriptor;
  dependencies: ProviderRuntimeDependencies;
  egress: OfficialSiteEgress;
  paths?: readonly string[];
  userAgent?: string;
}): EmailFindProvider {
  const { descriptor, dependencies } = config;
  if (!config.egress || typeof config.egress.fetchText !== "function") {
    throw new Error("Official-site fallback requires an authorized egress dependency");
  }
  const egress = config.egress;
  const paths = (config.paths ?? DEFAULT_PATHS).slice(0, 5);
  const userAgent = config.userAgent ?? "IntentLeadAI/1.0";
  return {
    descriptor,
    async findEmail(inputValue: EmailFindInput, context: ProviderCallContext): Promise<ProviderResult<ContactDiscoveryCandidate[]>> {
      const input = EmailFindInputSchema.parse(inputValue);
      return runRecordedProvider({
        descriptor, context, dependencies, inputCount: 1,
        inputFingerprint: `${input.companyId}\n${input.companyDomain}\n${input.scope}`,
        async run(operation): Promise<ProviderOperationResult<ContactDiscoveryCandidate[]>> {
          if (input.scope !== "COMPANY") return unknownResult();
          const companyDomain = normalizeCompanyRootDomain(input.companyDomain);
          if (!companyDomain) throw new ProviderMalformedResponseError();
          const contacts = new Map<string, ContactDiscoveryCandidate>();
          const provenance = new Map<string, ReturnType<typeof makeProvenance>>();
          let requestCount = 0;
          let rawRecordCount = 0;
          let normalizedRecordCount = 0;

          for (const path of paths) {
            if (operation.signal.aborted) throw new ProviderCancelledError();
            const sourceUrl = normalizeOfficialPage(companyDomain, path);
            if (!sourceUrl) continue;
            requestCount++;
            operation.recordRequest();
            try {
              const html = await egress.fetchText({
                sourceUrl,
                expectedRootDomain: companyDomain,
                init: {
                  method: "GET", redirect: "error",
                  headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": userAgent },
                },
                maxResponseBytes: dependencies.maxResponseBytes,
                signal: operation.signal,
              });
              const found = html.match(EMAIL_PATTERN) ?? [];
              rawRecordCount += found.length;
              for (const email of found) {
                const normalized = normalizeBusinessEmail(email, companyDomain);
                if (!normalized) continue;
                normalizedRecordCount++;
                const candidate = ContactDiscoveryCandidateSchema.parse({
                  state: "FOUND", channel: "email", value: normalized, scope: "COMPANY",
                  source: { kind: "PUBLIC_WEB", url: sourceUrl, providerRunId: null },
                  capturedAt: dependencies.now().toISOString(), confidence: 0.85,
                });
                if (!contacts.has(normalized)) {
                  contacts.set(normalized, candidate);
                  const sourceId = stableProviderSourceId("official_company_site", `${sourceUrl}\n${normalized}`);
                  provenance.set(normalized, makeProvenance(sourceId, sourceUrl, operation.providerRunId, dependencies));
                }
                if (contacts.size >= dependencies.maxRecords) break;
              }
            } catch (error) {
              if (error instanceof ProviderCancelledError || operation.signal.aborted) throw new ProviderCancelledError();
              if (error instanceof ProviderHttpError && error.status === 404) continue;
              if (!contacts.size) throw error;
              const mapped = mapProviderFailure(error, descriptor, context);
              return result(contacts, provenance, requestCount, rawRecordCount, normalizedRecordCount, descriptor, {
                failureKind: mapped.failureKind, capabilityError: mapped.capabilityError,
              });
            }
            if (contacts.size >= dependencies.maxRecords) break;
          }
          return result(contacts, provenance, requestCount, rawRecordCount, normalizedRecordCount, descriptor);
        },
      });
    },
  };
}

function normalizeOfficialPage(companyDomain: string, path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const value = normalizeHttpUrl(path, `https://${companyDomain}`);
  if (!value) return null;
  return normalizeCompanyRootDomain(value) === companyDomain ? value : null;
}

function normalizeBusinessEmail(value: string, companyDomain: string): string | null {
  const email = value.trim().toLowerCase();
  const separator = email.lastIndexOf("@");
  if (separator <= 0 || normalizeCompanyRootDomain(email.slice(separator + 1)) !== companyDomain) return null;
  return ROLE_LOCAL_PARTS.has(email.slice(0, separator)) ? email : null;
}

function unknownResult(): ProviderOperationResult<ContactDiscoveryCandidate[]> {
  return {
    value: [],
    status: "EMPTY", usage: { requestCount: 0, recordCount: 0, rawRecordCount: 0, normalizedRecordCount: 0, deduplicatedRecordCount: 0 },
    provenance: [], limitations: ["Official-site fallback only resolves company-scoped role addresses."],
  };
}

function result(
  contacts: Map<string, ContactDiscoveryCandidate>,
  provenance: Map<string, ReturnType<typeof makeProvenance>>,
  requestCount: number,
  rawRecordCount: number,
  normalizedRecordCount: number,
  descriptor: ProviderDescriptor,
  partial?: { failureKind: ProviderFailureKind; capabilityError: CapabilityError },
): ProviderOperationResult<ContactDiscoveryCandidate[]> {
  const value = [...contacts.values()];
  return {
    value, status: partial ? "PARTIAL" : value.length ? "SUCCEEDED" : "EMPTY",
    ...(partial ? partial : {}),
    usage: { requestCount, recordCount: value.length, rawRecordCount, normalizedRecordCount, deduplicatedRecordCount: value.length },
    provenance: [...provenance.values()],
    limitations: ["Only public company-scoped role addresses on the official domain are returned; no verification is implied."],
    actualCost: descriptor.configuredCost.amount === 0 ? 0 : null,
  };
}

function makeProvenance(sourceId: string, sourceUrl: string, providerRunId: string, dependencies: ProviderRuntimeDependencies) {
  return { schemaVersion: 1 as const, providerId: "official_company_site", providerSourceId: sourceId, providerRunId, capturedAt: dependencies.now().toISOString(), sourceUrl };
}
