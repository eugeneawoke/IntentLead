import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getServerClient } from "@/lib/supabase/client";

export async function requireUserSC(): Promise<{ id: string; email?: string }> {
  const cookieStore = await cookies();
  const supabase = getServerClient(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/?auth=1");
  return { id: user.id, email: user.email };
}
