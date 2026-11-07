"use client";

import { useEffect, useRef, useState } from "react";

import { formatBytesNumber } from "@/lib/preview-html";

import {
  ExternalLinkIcon,
  MonitorIcon,
  RefreshIcon,
  SmartphoneIcon,
} from "./icons";

type Viewport = "desktop" | "mobile";

export function PreviewPane({
  html,
  src,
  streaming,
  files,
  size,
  shareUrl,
  className = "",
}: {
  /** Inlined single-document preview, rebuilt on every stream flush. */
  html: string | null;
  /** Storage-backed multi-page preview, used once a build is complete. */
  src: string | null;
  streaming: boolean;
  files: string[];
  size: number;
  shareUrl?: string | null;
  className?: string;
}) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const previousUrl = useRef<string | null>(null);

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
      title="Live preview"
      src={target ?? undefined}
      sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
      className="h-full w-full border-0 bg-white"
    />
  ) : null;

  return (
    <section
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0C0C0F] ${className}`}
      aria-label="Live preview"
    >
      {/* URL bar, like the workspace preview header. */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-white/10 px-2">
        <button
          type="button"
          onClick={() => setReloadToken((token) => token + 1)}
          disabled={!hasOutput}
          title="Reload preview"
          className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30"
        >
          <RefreshIcon className="h-3.5 w-3.5" />
        </button>

        <div className="mx-auto flex h-7 min-w-0 max-w-[70%] flex-1 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3">
          <span className="truncate font-mono text-[10px] text-white/55">
            {streaming
              ? files.length > 0
                ? `writing ${files[files.length - 1]}…`
                : "starting build…"
              : hasOutput
                ? `${files.length} file${files.length === 1 ? "" : "s"} · ${formatBytesNumber(size)}`
                : "preview"}
          </span>
        </div>

        {shareUrl ? (
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            title="Open published page"
            className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </a>
        ) : (
          <span className="grid h-7 w-7 place-items-center rounded-md text-white/20" aria-hidden="true">
            <ExternalLinkIcon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        {hasOutput ? (
          <div className="h-full p-2 sm:p-3">
            {viewport === "desktop" ? (
              <div className="h-full overflow-hidden rounded-lg border border-white/10 bg-white">{iframe}</div>
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="flex h-full w-full max-w-[360px] flex-col overflow-hidden rounded-[24px] border border-white/15 bg-[#111114] p-1.5">
                  <div className="flex justify-center pb-1 pt-1">
                    <span className="h-1 w-10 rounded-full bg-white/20" />
                  </div>
                  <div className="flex-1 overflow-hidden rounded-[18px] bg-white">{iframe}</div>
                </div>
              </div>
            )}
          </div>
        ) : streaming ? (
          <GeneratingState />
        ) : (
          <EmptyState />
        )}

        {/* Floating viewport toolbar, anchored like the workspace bottom bar. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-white/12 bg-[#17171B]/95 p-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)] backdrop-blur">
            <button
              type="button"
              onClick={() => setViewport("desktop")}
              aria-pressed={viewport === "desktop"}
              title="Desktop viewport"
              className={`grid h-6 w-7 place-items-center rounded-full transition-colors ${
                viewport === "desktop" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              <MonitorIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewport("mobile")}
              aria-pressed={viewport === "mobile"}
              title="Mobile viewport"
              className={`grid h-6 w-7 place-items-center rounded-full transition-colors ${
                viewport === "mobile" ? "bg-white text-black" : "text-white/55 hover:text-white"
              }`}
            >
              <SmartphoneIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04]">
        <span className="h-1.5 w-1.5 rounded-full bg-[#F43E01]" />
      </span>
      <h2 className="mt-4 text-[15px] font-medium text-white/85">Nothing rendered yet</h2>
      <p className="mt-1.5 max-w-[30ch] text-[12px] leading-relaxed text-white/40">
        Describe a site in the chat and the files will stream in here.
      </p>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#F43E01]" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/50">
          Writing the first file
        </span>
      </div>
      <div className="mt-6 w-full max-w-md space-y-2.5">
        <div className="h-2 w-2/5 animate-pulse rounded bg-white/10" />
        <div className="h-8 w-4/5 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-2 w-3/5 animate-pulse rounded bg-white/10" />
      </div>
    </div>
  );
}
