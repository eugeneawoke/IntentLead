import type { Metadata } from "next";
import "./globals.css";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/layout/SiteHeader";
import ClientProviders from "@/components/auth/ClientProviders";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "IntentLead AI — Find people ready to buy",
  description: "Signal → Company → Email → Message. Pay only for leads that pass all 4 verification levels.",
  openGraph: {
    title: "IntentLead AI — Find people ready to buy",
    description: "Signal → Company → Email → Message. Pay only for leads that pass all 4 verification levels.",
    siteName: "IntentLead AI",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "IntentLead AI — Find people ready to buy",
    description: "Signal → Company → Email → Message.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", dmSans.variable, spaceGrotesk.variable)}>
      <body style={{ backgroundColor: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
        <ClientProviders>
          <SiteHeader />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
