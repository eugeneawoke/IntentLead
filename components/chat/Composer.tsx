"use client";
import { useChat } from "ai/react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Mic, ArrowUp } from "lucide-react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initSentRef = useRef(false);

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/chat",
      body: { conversationId, scanId: scanId ?? undefined },
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

  function onSubmit(e: React.FormEvent) {
    setStarted(true);
    handleSubmit(e);
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
              <button
                type="button"
                className="text-xs px-3 py-1 rounded-full flex items-center gap-1"
                style={{
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "none",
                  cursor: "default",
                }}
              >
                Plan{" "}
                <span style={{ color: "var(--text-faint)", fontSize: 10 }}>
                  ▾
                </span>
              </button>

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
