import { getServiceClient } from "@/lib/supabase/client";

export async function checkStrictRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false;
  try {
    const { data, error } = await getServiceClient().rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: limit,
      p_window_seconds: Math.ceil(windowMs / 1_000),
    });
    return !error && data === true;
  } catch {
    return false;
  }
}
