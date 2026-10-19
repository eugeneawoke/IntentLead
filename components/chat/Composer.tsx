"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Mic, Plus } from "lucide-react";

type ChatMode = "discover" | "refine" | "research";
type Message = { id: string; role: "user" | "assistant"; content: string };

const MODE_OPTIONS: Array<{ value: ChatMode; label: string; description: string }> = [
  { value: "discover", label: "Discover", description: "Find evidence-backed opportunities" },
  { value: "refine", label: "Refine", description: "Clarify your offer and ideal customer" },
  { value: "research", label: "Research", description: "Structure a broader discovery brief" },
];

const PLACEHOLDERS = [
  "Who are you selling to and what pain do you solve?",
  "Describe your ideal customer...",
  "What kind of opportunity do you want to find?",
];

const REVIEW_NOTE =
  "Your request is ready to become a discovery brief. Continue in the workspace to review the offer, ICP, sources, and evidence requirements before starting discovery.";

export function Composer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initMessage = searchParams.get("init")?.trim() ?? "";
  const [input, setInput] = useState("");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [focused, setFocused] = useState(false);
  const [mode, setMode] = useState<ChatMode>("discover");
  const [modeOpen, setModeOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() =>
    initMessage
      ? [
          { id: "initial-user", role: "user", content: initMessage },
          { id: "initial-assistant", role: "assistant", content: REVIEW_NOTE },
        ]
      : [],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const modeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPlaceholder((current) => {
        const index = PLACEHOLDERS.indexOf(current);
        return PLACEHOLDERS[(index + 1) % PLACEHOLDERS.length];
      });
    }, 4000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
  }, [input]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!modeOpen) return;
    const close = (event: MouseEvent) => {
      if (!modeDropdownRef.current?.contains(event.target as Node)) setModeOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [modeOpen]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if (!content) return;
    const stamp = Date.now().toString();
    setMessages((current) => [
      ...current,
      { id: `${stamp}-user`, role: "user", content },
      { id: `${stamp}-assistant`, role: "assistant", content: REVIEW_NOTE },
    ]);
    setInput("");
  }

  return (
    <div className="w-full max-w-3xl flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="text-center mb-4">
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 48px)",
              fontWeight: 600,
              letterSpacing: "-0.02em",
              color: "var(--text)",
              fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            }}
          >
            Find the right opportunity.
          </h1>
          <p className="mt-2" style={{ color: "var(--text-muted)", fontSize: 16 }}>
            Describe your offer and ideal customer. You will review the brief before discovery begins.
          </p>
        </div>
      )}

      {messages.length > 0 && (
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto px-1 pb-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex"
              style={{ justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 16px",
                  borderRadius: message.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: message.role === "user" ? "var(--surface-2)" : "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}
              >
                {message.content}
                {message.role === "assistant" && (
                  <button
                    type="button"
                    onClick={() => router.push("/workspace/discovery")}
                    style={{
                      display: "block",
                      marginTop: 12,
                      border: 0,
                      borderRadius: 8,
                      padding: "8px 12px",
                      background: "var(--accent)",
                      color: "var(--accent-fg)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Review discovery brief
                  </button>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      <div
        className="rounded-3xl transition-all duration-200"
        style={{
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--border-strong)" : "var(--border)"}`,
          boxShadow: focused ? "var(--accent-glow)" : "0 4px 20px rgba(0,0,0,0.35)",
          padding: "16px 20px",
        }}
      >
        <form onSubmit={onSubmit}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={1}
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
              fontFamily: "var(--font-sans, 'DM Sans', sans-serif)",
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onSubmit(event as unknown as FormEvent);
              }
            }}
          />

          <div className="flex items-center justify-between mt-3">
            <button
              type="button"
              title="Add a site URL to the brief"
              className="flex items-center justify-center rounded-full"
              style={{ width: 32, height: 32, background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-muted)" }}
            >
              <Plus size={16} />
            </button>

            <div className="flex items-center gap-2">
              <div ref={modeDropdownRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setModeOpen((open) => !open)}
                  className="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                  style={{ background: "transparent", color: "var(--text-muted)", border: "none", cursor: "pointer" }}
                >
                  {MODE_OPTIONS.find((option) => option.value === mode)?.label} <span style={{ color: "var(--text-faint)", fontSize: 10 }}>▾</span>
                </button>
                {modeOpen && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 8px)", right: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "6px 0", minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", zIndex: 50 }}>
                    {MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setMode(option.value); setModeOpen(false); }}
                        style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 16px", background: mode === option.value ? "var(--surface-2)" : "transparent", border: "none", color: mode === option.value ? "var(--text)" : "var(--text-muted)", fontSize: 13, cursor: "pointer" }}
                      >
                        <span style={{ fontWeight: 600 }}>{option.label}</span>
                        <span style={{ display: "block", fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>{option.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" aria-label="Voice input is not enabled" className="flex items-center justify-center rounded-full" style={{ width: 32, height: 32, background: "transparent", border: "none", color: "var(--text-muted)" }}>
                <Mic size={16} />
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                aria-label="Add message"
                className="flex items-center justify-center rounded-full transition-all duration-150"
                style={{ width: 36, height: 36, border: "none", background: input.trim() ? "var(--accent)" : "var(--surface-2)", color: input.trim() ? "var(--accent-fg)" : "var(--text-faint)", cursor: input.trim() ? "pointer" : "not-allowed" }}
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
