import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IntentLead AI",
  description: "Find people ready to buy. Signal → Company → Email → Message.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
        {children}
      </body>
    </html>
  );
}
