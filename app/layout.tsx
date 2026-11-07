import type { Metadata, Viewport } from "next";

import { ToastProvider } from "@/components/Toast";

import "./globals.css";

export const metadata: Metadata = {
  title: "Openmi — describe it, watch it ship",
  description:
    "Openmi turns a prompt into a working web UI. Generate Tailwind interfaces with AI, preview them instantly and publish a shareable link.",
  applicationName: "Openmi",
  openGraph: {
    title: "Openmi — describe it, watch it ship",
    description: "AI front-end builder with instant live preview and shareable links.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#F3F3EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-dvh bg-paper font-sans text-ink">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
