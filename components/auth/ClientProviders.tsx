"use client";

import { type ReactNode } from "react";
import { AuthModalProvider } from "./AuthModalContext";
import AuthModal from "./AuthModal";
import { AnonSessionTransfer } from "./AnonSessionTransfer";

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthModalProvider>
      {children}
      <AuthModal />
      <AnonSessionTransfer />
    </AuthModalProvider>
  );
}
