"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/client";
import { ANON_SESSION_KEY } from "@/types/anonSession";

export function AnonSessionTransfer() {
  const router = useRouter();

  useEffect(() => {
    const supabase = getBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "SIGNED_IN") return;

      const raw = localStorage.getItem(ANON_SESSION_KEY);
      if (!raw) return;

      try {
        const anonSession = JSON.parse(raw);
        const res = await fetch("/api/session/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anonSession }),
        });

        if (res.ok) {
          localStorage.removeItem(ANON_SESSION_KEY);
        }
      } catch {
        // Non-critical: transfer failed, user still signed in
      }

      router.push("/workspace");
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return null;
}
