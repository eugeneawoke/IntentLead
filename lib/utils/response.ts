export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export function ok<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function err(error: string): ApiResponse<undefined> {
  return { success: false, error };
}
