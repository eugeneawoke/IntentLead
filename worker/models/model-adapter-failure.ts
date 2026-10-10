export type ModelAdapterFailureCode =
  | "POLICY_DENIED"
  | "CAPABILITY_UNAVAILABLE"
  | "MALFORMED_RESPONSE";

export interface ModelAdapterFailureTelemetry {
  providerResponseId?: string;
  reportedModel?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class ModelAdapterFailure extends Error {
  readonly code: ModelAdapterFailureCode;
  readonly providerResponseId?: string;
  readonly reportedModel?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;

  constructor(message: string, code: ModelAdapterFailureCode, telemetry: ModelAdapterFailureTelemetry = {}) {
    super(message);
    this.name = "ModelAdapterFailure";
    this.code = code;
    this.providerResponseId = telemetry.providerResponseId;
    this.reportedModel = telemetry.reportedModel;
    this.inputTokens = telemetry.inputTokens;
    this.outputTokens = telemetry.outputTokens;
  }
}
