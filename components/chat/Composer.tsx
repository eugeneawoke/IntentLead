"use client";
import { useChat } from "ai/react";
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

const PLACEHOLDERS = [
  "Who are you selling to and what pain do you solve?",
  "Describe your ideal customer...",
  "Who do you want to find today?",
];

export function Composer() {
  const searchParams = useSearchParams();
  const scanId = searchParams.get("scanId");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [focused, setFocused] = useState(false);
  const [conversationId] = useState(() => crypto.randomUUID());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: { conversationId, scanId: scanId ?? undefined },
  });

  // Rotate placeholders
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholder((prev) => {
        const idx = PLACEHOLDERS.indexOf(prev);
        return PLACEHOLDERS[(idx + 1) % PLACEHOLDERS.length];
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "10px 16px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: m.role === "user" ? "var(--surface-2)" : "var(--surface)",
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
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "10px 16px",
                  borderRadius: "16px 16px 16px 4px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                  fontSize: 14,
                }}
              >
                <span style={{ animation: "pulse 1.6s ease-in-out infinite" }}>...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          background: "var(--surface)",
          border: `1px solid ${focused ? "var(--border-strong)" : "var(--border)"}`,
          borderRadius: 24,
          padding: "12px 16px",
          boxShadow: focused ? "var(--accent-glow)" : "none",
          transition: "border-color 180ms, box-shadow 180ms",
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: "var(--text)", fontSize: 24, fontWeight: 600, marginBottom: 12, lineHeight: 1.3 }}>
            Find people ready to buy.
          </div>
        )}
        <form onSubmit={handleSubmit} style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder}
            rows={1}
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text)",
              fontSize: 15,
              resize: "none",
              lineHeight: 1.5,
              padding: 0,
              fontFamily: "Inter, sans-serif",
              overflowY: "hidden",
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: isLoading || !input.trim() ? "var(--surface-2)" : "var(--accent)",
              color: "var(--accent-fg)",
              cursor: isLoading || !input.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 16,
              transition: "background 180ms",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
