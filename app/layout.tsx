import type { Metadata } from "next";
import "./globals.css";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import SiteHeader from "@/components/layout/SiteHeader";
import ClientProviders from "@/components/auth/ClientProviders";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700"] });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans", weight: ["400", "500", "600"] });

// JSON-LD structured data — static constant, no user input, safe to inject
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "IntentLead AI",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Find B2B leads from public intent signals. Signal → Company → Email → Message. Pay only when all 4 verification levels pass.",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD",
    "description": "10 verified leads free, no credit card required",
  },
  "url": process.env.NEXT_PUBLIC_APP_URL ?? "https://intent-lead-hazel.vercel.app",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://intent-lead-hazel.vercel.app"),
  title: "IntentLead AI — Find people ready to buy",
  description: "Signal → Company → Email → Message. Pay only for leads that pass all 4 verification levels.",
  alternates: { canonical: "/" },
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
      <head>
        {/* eslint-disable-next-line @next/next/no-before-interactive-script-outside-document */}
        <script
          type="application/ld+json"
          // Safe: jsonLd is a hardcoded static object — no user input involved
          // nosec
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ backgroundColor: "var(--bg)", color: "var(--text)", minHeight: "100vh" }}>
        <ClientProviders>
          <SiteHeader />
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
