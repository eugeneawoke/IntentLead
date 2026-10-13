"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthModal } from "@/components/auth/AuthModalContext";

export function AuthTrigger() {
  const searchParams = useSearchParams();
  const { openModal } = useAuthModal();

  useEffect(() => {
    if (searchParams.get("auth") === "1") {
      openModal("signin");
    }
  }, [searchParams, openModal]);

  return null;
}
