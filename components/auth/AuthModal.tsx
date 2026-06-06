"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthModal } from "./AuthModalContext";
import { getBrowserClient } from "@/lib/supabase/client";

// ── Google SVG ────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.06364 7.50914C4.70909 4.24092 8.09084 2 12 2C14.6954 2 16.959 2.99095 18.6909 4.60455L15.8227 7.47274C14.7864 6.48185 13.4681 5.97727 12 5.97727C9.39542 5.97727 7.19084 7.73637 6.40455 10.1C6.2045 10.7 6.09086 11.3409 6.09086 12C6.09086 12.6591 6.2045 13.3 6.40455 13.9C7.19084 16.2636 9.39542 18.0227 12 18.0227C13.3454 18.0227 14.4909 17.6682 15.3864 17.0682C16.4454 16.3591 17.15 15.3 17.3818 14.05H12V10.1818H21.4181C21.5364 10.8363 21.6 11.5182 21.6 12.2273C21.6 15.2727 20.5091 17.8363 18.6181 19.5773C16.9636 21.1046 14.7 22 12 22C8.09084 22 4.70909 19.7591 3.06364 16.4909C2.38638 15.1409 2 13.6136 2 12C2 10.3864 2.38638 8.85911 3.06364 7.50914Z" />
    </svg>
  );
}

// ── Close icon ────────────────────────────────────────
function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Input ─────────────────────────────────────────────
function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
      onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
      style={{
        width: "100%",
        padding: "11px 14px",
        borderRadius: 12,
        background: "var(--bg)",
        border: `1px solid ${focused ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.1)"}`,
        color: "var(--text)",
        fontSize: 14,
        outline: "none",
        transition: "border-color 0.15s",
        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
        boxSizing: "border-box",
      }}
    />
  );
}

// ── Main modal ────────────────────────────────────────
export default function AuthModal() {
  const { open, mode, setMode, closeModal } = useAuthModal();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const backdropRef = useRef<HTMLDivElement>(null);

  // Reset on mode change
  useEffect(() => {
    setEmail("");
    setSent(false);
    setError("");
    setLoading(false);
  }, [mode, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeModal(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, closeModal]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const supabase = getBrowserClient();
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}/workspace` },
        });
        if (err) throw err;
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
    try {
      const supabase = getBrowserClient();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/workspace` },
      });
    } catch {
      setError("Google sign-in failed");
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        const supabase = getBrowserClient();
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (err) throw err;
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const isForgot = mode === "forgot";
  const isSignup = mode === "signup";

  const title = isForgot ? "Reset password" : isSignup ? "Create account" : "Welcome back";
  const subtitle = isForgot
    ? "Enter your email and we'll send a reset link."
    : isSignup
    ? "Already have an account?"
    : "First time here?";
  const subtitleLink = isForgot ? null : isSignup ? "Sign in" : "Sign up for free";
  const subtitleMode: "signin" | "signup" = isSignup ? "signin" : "signup";

  const sentTitle = isForgot ? "Check your inbox" : "Magic link sent";
  const sentText = isForgot
    ? `Password reset link sent to ${email}`
    : `We sent a sign-in link to ${email}. Click it to continue.`;

  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        onClick={(e) => { if (e.target === backdropRef.current) closeModal(); }}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.72)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          animation: "modal-fade-in 0.18s ease",
        }}
      >
        {/* Card */}
        <div
          style={{
            position: "relative",
            width: "100%",
            maxWidth: 400,
            background: "var(--surface)",
            border: "1px solid rgba(255,255,255,0.09)",
            borderRadius: 24,
            padding: "40px 32px 32px",
            boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
            animation: "modal-slide-up 0.22s ease",
            fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
          }}
        >
          {/* Close button */}
          <button
            onClick={closeModal}
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              width: 32,
              height: 32,
              borderRadius: 8,
              background: "transparent",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.8)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)"; }}
            aria-label="Close"
          >
            <CloseIcon />
          </button>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--text)",
                margin: "0 0 6px",
                fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>
                {subtitle}{" "}
                {subtitleLink && (
                  <button
                    onClick={() => setMode(subtitleMode)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      padding: 0,
                      textDecoration: "underline",
                      textUnderlineOffset: 2,
                    }}
                  >
                    {subtitleLink}
                  </button>
                )}
              </p>
            )}
          </div>

          {/* Sent confirmation */}
          {sent ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 0",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(163,230,53,0.12)",
                  border: "1.5px solid rgba(163,230,53,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                ✓
              </div>
              <p style={{ fontSize: 14, color: "var(--text)", fontWeight: 500, margin: 0 }}>
                {sentTitle}
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                {sentText}
              </p>
              <button
                onClick={() => setSent(false)}
                style={{
                  marginTop: 8,
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: 2,
                }}
              >
                Use a different email
              </button>
            </div>
          ) : (
            /* Form */
            <form onSubmit={isForgot ? handleForgot : handleMagicLink}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <AuthInput
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />

                {error && (
                  <p style={{ fontSize: 12, color: "#F87171", margin: 0 }}>{error}</p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 12,
                    background: loading || !email.trim() ? "rgba(163,230,53,0.4)" : "var(--accent)",
                    color: "#0A0C0F",
                    fontWeight: 600,
                    fontSize: 14,
                    border: "none",
                    cursor: loading || !email.trim() ? "not-allowed" : "pointer",
                    transition: "opacity 0.15s",
                    fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                  }}
                >
                  {loading
                    ? "Sending…"
                    : isForgot
                    ? "Send reset link"
                    : isSignup
                    ? "Send magic link"
                    : "Send me the magic link"}
                </button>

                {!isForgot && (
                  <>
                    {/* Divider */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        margin: "4px 0",
                      }}
                    >
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                      <span style={{ fontSize: 12, color: "var(--text-faint)" }}>OR</span>
                      <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                    </div>

                    {/* Google */}
                    <button
                      type="button"
                      onClick={handleGoogle}
                      style={{
                        width: "100%",
                        padding: "11px",
                        borderRadius: 12,
                        background: "transparent",
                        border: "1px solid rgba(255,255,255,0.12)",
                        color: "var(--text)",
                        fontSize: 14,
                        fontWeight: 500,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        transition: "border-color 0.15s",
                        fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.25)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.12)"; }}
                    >
                      <GoogleIcon />
                      Continue with Google
                    </button>
                  </>
                )}

                {/* Forgot password link — only on signin */}
                {mode === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "center",
                      padding: 0,
                      marginTop: 2,
                    }}
                  >
                    Forgot password?
                  </button>
                )}

                {/* Back to signin — only on forgot */}
                {isForgot && (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--text-muted)",
                      fontSize: 12,
                      cursor: "pointer",
                      textAlign: "center",
                      padding: 0,
                      marginTop: 2,
                    }}
                  >
                    ← Back to sign in
                  </button>
                )}
              </div>
            </form>
          )}

          {/* Terms */}
          <p
            style={{
              textAlign: "center",
              fontSize: 11,
              color: "var(--text-faint)",
              marginTop: 24,
              lineHeight: 1.5,
            }}
          >
            By continuing you agree to our{" "}
            <a href="/terms" style={{ color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 2 }}>
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" style={{ color: "var(--text-muted)", textDecoration: "underline", textUnderlineOffset: 2 }}>
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </div>

      <style>{`
        @keyframes modal-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modal-slide-up {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
