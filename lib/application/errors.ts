export type ApplicationErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "POLICY_DENIED"
  | "CAPABILITY_UNAVAILABLE"
  | "BUDGET_EXCEEDED"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const statusByCode: Record<ApplicationErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  POLICY_DENIED: 403,
  CAPABILITY_UNAVAILABLE: 503,
  BUDGET_EXCEEDED: 402,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApplicationError extends Error {
  readonly status: number;

  constructor(readonly code: ApplicationErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ApplicationError";
    this.status = statusByCode[code];
  }
}
