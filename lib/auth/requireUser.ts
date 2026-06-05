import { cookies } from "next/headers";
import { getServerClient } from "@/lib/supabase/client";
import { err } from "@/lib/utils/response";
import { NextResponse } from "next/server";

export async function requireUser() {
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, response: NextResponse.json(err("Unauthorized"), { status: 401 }) };
  }
  return { user, response: null };
}
