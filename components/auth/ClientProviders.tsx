"use client";

import { type ReactNode } from "react";
import { AuthModalProvider } from "./AuthModalContext";
import AuthModal from "./AuthModal";
import { AnonSessionTransfer } from "./AnonSessionTransfer";
import { LangProvider } from "@/lib/i18n/LangContext";
import { UserProvider } from "@/lib/auth/UserContext";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <LangProvider>
      <UserProvider>
        <AuthModalProvider>
          {children}
          <AuthModal />
          <AnonSessionTransfer />
        </AuthModalProvider>
      </UserProvider>
    </LangProvider>
  );
}
