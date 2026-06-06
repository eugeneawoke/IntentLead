"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

export type AuthMode = "signin" | "signup" | "forgot";

interface AuthModalCtx {
  open: boolean;
  mode: AuthMode;
  openModal: (mode?: AuthMode) => void;
  closeModal: () => void;
  setMode: (mode: AuthMode) => void;
}

const Ctx = createContext<AuthModalCtx | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");

  function openModal(m: AuthMode = "signin") {
    setMode(m);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  return (
    <Ctx.Provider value={{ open, mode, openModal, closeModal, setMode }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthModal must be used inside AuthModalProvider");
  return ctx;
}
