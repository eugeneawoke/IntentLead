"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getBrowserClient } from "@/lib/supabase/client";
import { useAuthModal } from "@/components/auth/AuthModalContext";
import type { User } from "@supabase/supabase-js";

export function CompareHeroButton() {
  const [user, setUser] = useState<User | null>(null);
  const { openModal } = useAuthModal();

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    try {
      const supabase = getBrowserClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
      });
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
        setUser(s?.user ?? null);
      });
      return () => subscription.unsubscribe();
    } catch {
      // Supabase not configured
    }
  }, []);

  if (user) {
    return (
      <Link
        href="/chat"
        style={{
          display: "inline-block",
          padding: "14px 32px",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          borderRadius: 12,
          fontSize: 16,
          fontWeight: 700,
          textDecoration: "none",
          letterSpacing: "-0.01em",
        }}
      >
        Go to workspace →
      </Link>
    );
  }

  return (
    <button
      onClick={() => openModal("signup")}
      style={{
        display: "inline-block",
        padding: "14px 32px",
        background: "var(--accent)",
        color: "var(--accent-fg)",
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 700,
        border: "none",
        cursor: "pointer",
        letterSpacing: "-0.01em",
        fontFamily: "inherit",
      }}
    >
      Get started free
    </button>
  );
}
