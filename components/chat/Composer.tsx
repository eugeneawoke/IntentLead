"use client";
import { useChat } from "ai/react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Mic, ArrowUp } from "lucide-react";
import { ANON_SESSION_KEY } from "@/types/anonSession";

type ChatMode = "search" | "plan" | "strategy";

const MODE_OPTIONS: { value: ChatMode; label: string; description: string }[] = [
  { value: "search", label: "Search", description: "Find leads matching your ICP" },
  { value: "plan", label: "Plan", description: "Build an outbound campaign plan" },
  { value: "strategy", label: "Strategy", description: "Full go-to-market strategy" },
];

const PLACEHOLDERS = [
  "Who are you selling to and what pain do you solve?",
  "Describe your ideal customer...",
  "Who do you want to find today?",
];

export function Composer() {
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId");
  const initMsg = searchParams.get("init");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [focused, setFocused] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<ChatMode>("search");
  const [modeOpen, setModeOpen] = useState(false);
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const initSentRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
      body: { conversationId, scanId: scanId ?? undefined },
      onResponse: (response) => {
        if (response.status === 402) setUpgradeNeeded(true);
      },
    });

  // Rotate placeholders
  useEffect(() => {
    const t = setInterval(() => {
      setPlaceholder((prev) => {
        const i = PLACEHOLDERS.indexOf(prev);
        return PLACEHOLDERS[(i + 1) % PLACEHOLDERS.length];
      });
    }, 4000);
    return () => clearInterval(t);
  }, []);

  // Auto-submit ?init= message once
  useEffect(() => {
    if (initMsg && !initSentRef.current) {
      initSentRef.current = true;
      setStarted(true);
      append({ role: "user", content: initMsg });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initMsg]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  // Scroll to bottom + mark started
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (messages.length > 0) setStarted(true);
  }, [messages]);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length === 0) return;
    const raw = localStorage.getItem(ANON_SESSION_KEY);
    const session = raw ? JSON.parse(raw) : { messages: [], intake: {}, createdAt: new Date().toISOString() };
    session.messages = messages.map((m) => ({ role: m.role, content: m.content }));
    localStorage.setItem(ANON_SESSION_KEY, JSON.stringify(session));
  }, [messages]);

  // Close mode dropdown on outside click
  useEffect(() => {
    if (!modeOpen) return;
    function handleOutside(e: MouseEvent) {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setModeOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modeOpen]);

  function onSubmit(e: React.FormEvent) {
    setStarted(true);
    handleSubmit(e, { body: { mode } } as Parameters<typeof handleSubmit>[1]);
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      {/* Header — until first message */}
      {!started && (
        <div className="text-center mb-4">
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              fontFamily: "Geist, sans-serif",
            }}
          >
            Find people ready to buy.
          </h1>
          <p className="mt-2" style={{ color: "var(--text-muted)", fontSize: 16 }}>
            Describe who you&apos;re looking for and we&apos;ll find verified leads.
          </p>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto px-1 pb-2">
          {messages.map((m) => (
            <div
              key={m.id}
              className="flex"
              style={{
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 16px",
                  borderRadius:
                    m.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  background:
                    m.role === "user" ? "var(--surface-2)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex" style={{ justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "18px 18px 18px 4px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  fontSize: 18,
                  letterSpacing: 2,
                }}
              >
                •••
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Upgrade notice */}
      {upgradeNeeded && (
        <div style={{ background: "rgba(163,230,53,0.08)", border: "1px solid rgba(163,230,53,0.25)", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span>No credits remaining.</span>
          <a href="/pricing?utm_source=app&utm_medium=in-app&utm_campaign=upgrade-prompt&utm_content=credits-empty" style={{ background: "var(--accent)", color: "var(--accent-fg)", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            ⚡ Upgrade
          </a>
        </div>
      )}

      {/* Input */}
      <div
        className="rounded-3xl transition-all duration-200"
        style={{
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--border-strong)" : "var(--border)"}`,
          boxShadow: focused
            ? "var(--accent-glow)"
            : "0 4px 20px rgba(0,0,0,0.35)",
          padding: "16px 20px",
        }}
      >
        <form onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={1}
            disabled={isLoading}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 15,
              lineHeight: 1.6,
              resize: "none",
              overflowY: "hidden",
              fontFamily: "Inter, sans-serif",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e as unknown as React.FormEvent);
              }
            }}
          />

          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              title="Add site URL for scan"
              className="flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              <Plus size={16} />
            </button>

            <div className="flex items-center gap-2">
              <div ref={modeDropdownRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  className="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                  style={{
                    background: "transparent",
                    color: "var(--text-muted)",
                    border: "none",
                    cursor: "pointer",
                  }}
                  onClick={() => setModeOpen((o) => !o)}
                >
                  {MODE_OPTIONS.find((o) => o.value === mode)?.label ?? "Search"}{" "}
                  <span style={{ color: "var(--text-faint)", fontSize: 10 }}>▾</span>
                </button>

                {modeOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "calc(100% + 8px)",
                      right: 0,
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: "6px 0",
                      minWidth: 200,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      zIndex: 50,
                    }}
                  >
                    {MODE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setMode(opt.value); setModeOpen(false); }}
                        style={{
                          display: "block",
                          width: "100%",
                          textAlign: "left",
                          padding: "8px 16px",
                          background: mode === opt.value ? "var(--surface-2)" : "transparent",
                          border: "none",
                          color: mode === opt.value ? "var(--text)" : "var(--text-muted)",
                          fontSize: 13,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{opt.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                          {opt.description}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                className="flex items-center justify-center rounded-full"
                style={{
                  width: 32,
                  height: 32,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "default",
                }}
              >
                <Mic size={16} />
              </button>

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center justify-center rounded-full transition-all duration-150"
                style={{
                  width: 36,
                  height: 36,
                  border: "none",
                  background:
                    !isLoading && input.trim()
                      ? "var(--accent)"
                      : "var(--surface-2)",
                  color:
                    !isLoading && input.trim()
                      ? "var(--accent-fg)"
                      : "var(--text-faint)",
                  cursor:
                    !isLoading && input.trim() ? "pointer" : "not-allowed",
                }}
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
