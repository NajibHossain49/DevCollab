import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

import "./globals.css";

const siteUrl = process.env.AUTH_URL ?? "http://localhost:3000";
const description =
  "Collaborate on code in real time with live cursors, shared editing, AI assistance, and instant multi-language code execution.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "DevCollab — Real-time collaborative code editor",
    template: "%s · DevCollab",
  },
  description,
  applicationName: "DevCollab",
  keywords: [
    "collaborative code editor",
    "real-time coding",
    "pair programming",
    "live cursors",
    "Monaco editor",
    "Yjs",
    "code execution",
    "DevCollab",
  ],
  authors: [{ name: "DevCollab" }],
  creator: "DevCollab",
  openGraph: {
    type: "website",
    siteName: "DevCollab",
    title: "DevCollab — Real-time collaborative code editor",
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "DevCollab — Real-time collaborative code editor",
    description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
