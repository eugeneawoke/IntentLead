import type { z } from "zod";
import type {
  GroundedModelClaimSchema,
  ModelBudgetSchema,
  ModelCapabilitySchema,
  ModelInvocationPolicySchema,
  ModelProviderDescriptorSchema,
  ModelProviderIdSchema,
  ModelProviderStateSchema,
  StructuredDiscoveryIntakeSchema,
} from "../lib/domain/schemas/model-provider";

export type ModelCapability = z.infer<typeof ModelCapabilitySchema>;
export type ModelProviderId = z.infer<typeof ModelProviderIdSchema>;
export type ModelProviderState = z.infer<typeof ModelProviderStateSchema>;
export type ModelProviderDescriptor = z.infer<typeof ModelProviderDescriptorSchema>;
export type ModelBudget = z.infer<typeof ModelBudgetSchema>;
export type ModelInvocationPolicy = z.infer<typeof ModelInvocationPolicySchema>;
export type StructuredDiscoveryIntake = z.infer<typeof StructuredDiscoveryIntakeSchema>;
export type GroundedModelClaim = z.infer<typeof GroundedModelClaimSchema>;
