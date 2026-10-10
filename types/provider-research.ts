import type { z } from "zod";
import type {
  ContactDiscoveryCandidateSchema,
  ContactVerificationObservationSchema,
  EmailFindInputSchema,
  EmailVerifyInputSchema,
  PersonDiscoveryCandidateSchema,
  PersonSearchInputSchema,
} from "../lib/domain/schemas/provider-research";
import type {
  ProviderCallContext,
  ProviderDescriptor,
  ProviderResult,
} from "../worker/providers/contracts";

export type PersonSearchInput = z.infer<typeof PersonSearchInputSchema>;
export type PersonDiscoveryCandidate = z.infer<typeof PersonDiscoveryCandidateSchema>;
export type EmailFindInput = z.infer<typeof EmailFindInputSchema>;
export type ContactDiscoveryCandidate = z.infer<typeof ContactDiscoveryCandidateSchema>;
export type EmailVerifyInput = z.infer<typeof EmailVerifyInputSchema>;
export type ContactVerificationObservation = z.infer<typeof ContactVerificationObservationSchema>;

export interface PersonSearchProvider {
  readonly descriptor: ProviderDescriptor;
  searchPeople(input: PersonSearchInput, context: ProviderCallContext): Promise<ProviderResult<PersonDiscoveryCandidate[]>>;
}

export interface EmailFindProvider {
  readonly descriptor: ProviderDescriptor;
  findEmail(input: EmailFindInput, context: ProviderCallContext): Promise<ProviderResult<ContactDiscoveryCandidate[]>>;
}

export interface EmailVerifyProvider {
  readonly descriptor: ProviderDescriptor;
  verifyEmail(input: EmailVerifyInput, context: ProviderCallContext): Promise<ProviderResult<ContactVerificationObservation>>;
}
