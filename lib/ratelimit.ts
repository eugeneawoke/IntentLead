/**
 * Distributed rate limiter via Supabase (shared DB with Glook).
 * Uses check_rate_limit() RPC — atomic fixed-window counter, no TOCTOU.
 * Gracefully degrades to allow-all if Supabase is not configured.
 */
import { getServiceClient } from "@/lib/supabase/client";

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<boolean> {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    // Not configured — fail open
    return true;
  }

  try {
    const supabase = getServiceClient();
    const windowSeconds = Math.ceil(windowMs / 1000);
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: limit,
      p_window_seconds: windowSeconds,
    });

    if (error) {
      console.warn("[ratelimit] RPC error, allowing request:", error.message);
      return true; // fail open
    }

    return data === true;
  } catch (err) {
    console.warn("[ratelimit] Unexpected error, allowing request:", err);
    return true; // fail open
  }
}
