import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/client";
import { logger } from "@/lib/utils/logger";

export async function requireUserSC(): Promise<{ id: string; email?: string }> {
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!user) {
    if (error) logger.error({ err: error.message }, "[requireUserSC] getUser error");
    redirect("/?auth=1");
  }
  return { id: user.id, email: user.email };
}
