import { Suspense } from "react";
import { Composer } from "@/components/chat/Composer";

export default function ChatPage() {
  return (
    <main
      style={{
        background: "var(--bg)",
        color: "var(--text)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <Suspense fallback={<div style={{ color: "var(--text-muted)" }}>Loading...</div>}>
        <Composer />
      </Suspense>
    </main>
  );
}
