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
  themeColor: "#020617",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-dvh bg-slate-950 font-sans text-slate-100">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
