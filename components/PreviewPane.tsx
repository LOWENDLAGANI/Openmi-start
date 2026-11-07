"use client";

import { useEffect, useRef, useState } from "react";

import { buildPreviewDocument, formatBytes } from "@/lib/preview-html";

import { ArrowRightIcon, LayersIcon, MonitorIcon, RefreshIcon, SmartphoneIcon } from "./icons";

type Viewport = "desktop" | "mobile";

export function PreviewPane({
  code,
  streaming,
  className = "",
}: {
  code: string;
  streaming: boolean;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const previousUrl = useRef<string | null>(null);

  /**
   * Every code change becomes a fresh Blob URL, which is what the iframe loads.
   * Old URLs are revoked a little later so an in-flight navigation can finish.
   */
  useEffect(() => {
    if (!code.trim()) {
      setBlobUrl(null);
      return;
    }

    const document = buildPreviewDocument(code);
    const nextUrl = URL.createObjectURL(new Blob([document], { type: "text/html" }));
    const stale = previousUrl.current;

    previousUrl.current = nextUrl;
    setBlobUrl(nextUrl);

    if (stale) {
      const timer = window.setTimeout(() => URL.revokeObjectURL(stale), 20_000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [code]);

  useEffect(() => {
    return () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    };
  }, []);

  const hasCode = Boolean(code.trim());
  const iframe = hasCode ? (
    <iframe
      key={`${blobUrl ?? "empty"}-${reloadToken}`}
      title="Openmi live preview"
      src={blobUrl ?? undefined}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      className="h-full w-full border-0 bg-slate-950"
    />
  ) : null;

  return (
    <section
      className={`surface flex flex-col overflow-hidden lg:min-h-0 ${className}`}
      aria-label="Live preview"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs text-slate-500">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              streaming ? "animate-pulse bg-amber-400" : hasCode ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
          <span className="truncate">
            {streaming ? "Streaming preview…" : hasCode ? `Live preview · ${formatBytes(code)}` : "No preview yet"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              aria-pressed={viewport === "desktop"}
              title="Desktop viewport"
              className={`focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                viewport === "desktop" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <MonitorIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              aria-pressed={viewport === "mobile"}
              title="Mobile viewport"
              className={`focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                viewport === "mobile" ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
              }`}
            >
              <SmartphoneIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            disabled={!hasCode}
            title="Reload preview"
            className="focus-ring rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 transition hover:border-white/20 hover:text-white disabled:opacity-40"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-slate-950">
        {hasCode ? (
          viewport === "desktop" ? (
            <div className="h-full w-full bg-slate-950">{iframe}</div>
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#050914] p-4">
              <div className="flex h-full w-full max-w-[390px] flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900 p-2 shadow-2xl shadow-black/60">
                <div className="flex justify-center pb-2 pt-1">
                  <span className="h-1 w-14 rounded-full bg-white/20" />
                </div>
                <div className="flex-1 overflow-hidden rounded-[1.5rem] bg-slate-950">{iframe}</div>
              </div>
            </div>
          )
        ) : streaming ? (
          <GeneratingState />
        ) : (
          <EmptyState />
        )}

        {streaming ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-white/5">
            <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-dotgrid opacity-30" />
      <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] text-emerald-300">
        <LayersIcon className="h-6 w-6" />
      </div>
      <div className="relative max-w-sm">
        <p className="text-sm font-medium text-slate-200">Your canvas is empty</p>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Describe an interface on the left and hit Generate. Tokens stream straight into this frame
          — no build step, no server render.
        </p>
      </div>
      <div className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] text-slate-500">
        <ArrowRightIcon className="h-3 w-3" />
        Try “a pricing page for a video editor”
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="flex h-full flex-col justify-center gap-4 px-8 py-10">
      <div className="flex items-center gap-2 text-xs text-emerald-300">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        Streaming the first tokens…
      </div>
      <div className="space-y-3">
        <div className="h-3 w-2/5 animate-pulse rounded-full bg-white/10" />
        <div className="h-8 w-4/5 animate-pulse rounded-lg bg-white/[0.07]" />
        <div className="h-3 w-3/5 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-24 animate-pulse rounded-xl border border-white/5 bg-white/[0.03]"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
