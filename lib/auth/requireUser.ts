import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/client";
import { err } from "@/lib/utils/response";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireUser(): Promise<
  | { user: null; supabase: null; response: NextResponse }
  | { user: { id: string; email?: string }; supabase: SupabaseClient; response: null }
> {
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, supabase: null, response: NextResponse.json(err("Unauthorized"), { status: 401 }) };
  }
  return { user: { id: user.id, email: user.email }, supabase: supabase as unknown as SupabaseClient, response: null };
}
