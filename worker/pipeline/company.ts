import { legacyProviderBridge } from "../providers/legacy";

export interface CompanyResult {
  companyName: string | null;
  companyDomain: string | null;
}

export async function identifyCompany(authorHandle: string, signalContent: string): Promise<CompanyResult> {
  return legacyProviderBridge.identifyCompany(authorHandle, signalContent);
}
