"use client";

import { useEffect, useRef, useState } from "react";

import { formatBytesNumber } from "@/lib/preview-html";

import { LayersIcon, MonitorIcon, RefreshIcon, SmartphoneIcon } from "./icons";

type Viewport = "desktop" | "mobile";

export function PreviewPane({
  html,
  src,
  streaming,
  files,
  size,
  className = "",
}: {
  /** Inlined single-document preview, rebuilt on every stream flush. */
  html: string | null;
  /** Storage-backed multi-page preview, used once a build is complete. */
  src: string | null;
  streaming: boolean;
  files: string[];
  size: number;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const previousUrl = useRef<string | null>(null);

  /**
   * Every preview update becomes a fresh Blob URL. Old URLs are revoked later
   * so an in-flight navigation can finish.
   */
  useEffect(() => {
    if (!html) {
      setBlobUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const stale = previousUrl.current;

    previousUrl.current = nextUrl;
    setBlobUrl(nextUrl);

    if (stale) {
      const timer = window.setTimeout(() => URL.revokeObjectURL(stale), 20_000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [html]);

  useEffect(() => {
    return () => {
      if (previousUrl.current) URL.revokeObjectURL(previousUrl.current);
    };
  }, []);

  // While streaming, the inline document is the live view. Afterwards the
  // storage URL takes over so relative links between pages resolve.
  const target = src && !streaming ? src : blobUrl;
  const hasOutput = Boolean(target);

  const iframe = hasOutput ? (
    <iframe
      key={`${target}-${reloadToken}`}
      title="Openmi live preview"
      src={target ?? undefined}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      className="h-full w-full border-0 bg-white"
    />
  ) : null;

  return (
    <section
      className={`flex min-h-0 flex-col border border-line bg-paperAlt ${className}`}
      aria-label="Live preview"
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              streaming ? "animate-pulse bg-brand" : hasOutput ? "bg-ink" : "bg-line"
            }`}
          />
          <span className="eyebrow truncate">
            {streaming
              ? `Streaming · ${files.length || 1} file${files.length === 1 ? "" : "s"}`
              : hasOutput
                ? `Live preview · ${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytesNumber(size)}`
                : "Live preview · empty"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-full border border-line bg-paper p-0.5">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              aria-pressed={viewport === "desktop"}
              title="Desktop viewport"
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                viewport === "desktop" ? "bg-ink text-paper" : "text-inkSoft hover:text-ink"
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
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                viewport === "mobile" ? "bg-ink text-paper" : "text-inkSoft hover:text-ink"
              }`}
            >
              <SmartphoneIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setReloadToken((token) => token + 1)}
            disabled={!hasOutput}
            title="Reload preview"
            className="rounded-full border border-line bg-paper p-1.5 text-inkSoft transition-colors hover:border-ink hover:text-ink disabled:opacity-40"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-paper">
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />

        {hasOutput ? (
          viewport === "desktop" ? (
            <div className="relative h-full p-3 sm:p-5">
              <BrowserFrame>{iframe}</BrowserFrame>
            </div>
          ) : (
            <div className="relative flex h-full items-center justify-center p-4">
              <div className="flex h-full w-full max-w-[366px] flex-col overflow-hidden rounded-[26px] border border-line bg-paperAlt p-1.5">
                <div className="flex justify-center pb-1.5 pt-1">
                  <span className="h-1 w-12 rounded-full bg-line" />
                </div>
                <div className="flex-1 overflow-hidden rounded-[19px] border border-line bg-white">{iframe}</div>
              </div>
            </div>
          )
        ) : streaming ? (
          <GeneratingState />
        ) : (
          <EmptyState />
        )}

        {streaming ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden bg-sand">
            <div className="h-full w-1/3 animate-sweep bg-brand" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden border border-line bg-white">
      <div className="flex h-8 shrink-0 items-center gap-3 border-b border-line bg-paperAlt px-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
          <span className="h-1.5 w-1.5 rounded-full bg-line" />
        </div>
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.14em] text-inkSoft sm:block">
          your project
        </span>
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />
      </div>
      <div className="min-h-0 flex-1 bg-white">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative flex h-full flex-col justify-center px-6 py-10 sm:px-10">
      <span className="eyebrow flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        Canvas
      </span>
      <h2 className="display mt-5 max-w-[14ch] text-[clamp(1.9rem,3.6vw,2.9rem)]">
        Nothing rendered yet.
      </h2>
      <p className="mt-4 max-w-[36ch] text-sm leading-relaxed text-inkSoft">
        Describe a site in the chat. The model writes a small multi-file project — pages, CSS and
        JS — and every file streams into this frame as it lands.
      </p>
      <div className="mt-7 flex w-fit items-center gap-2 border border-line bg-paperAlt px-3 py-2">
        <LayersIcon className="h-3.5 w-3.5 text-inkSoft" />
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-inkSoft">
          Try “a three-page site for a coffee roaster”
        </span>
      </div>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="relative flex h-full flex-col justify-center px-6 py-10 sm:px-10">
      <span className="eyebrow flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
        Writing the first file
      </span>
      <div className="mt-6 max-w-xl space-y-3">
        <div className="h-2.5 w-2/5 animate-pulse bg-line" />
        <div className="h-9 w-4/5 animate-pulse bg-sand" />
        <div className="h-2.5 w-3/5 animate-pulse bg-line" />
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-20 animate-pulse border border-line bg-paperAlt"
              style={{ animationDelay: `${index * 120}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
