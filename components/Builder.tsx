"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cleanGeneratedHtml, formatBytes } from "@/lib/preview-html";
import { PROMPT_EXAMPLES } from "@/lib/prompts";

import { useAuth } from "./AuthProvider";
import {
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  LoaderIcon,
  LogOutIcon,
  SparklesIcon,
} from "./icons";
import { Logo } from "./Logo";
import { PreviewPane } from "./PreviewPane";
import { useToast } from "./Toast";

const MAX_PROMPT_LENGTH = 2000;
const STREAM_FLUSH_MS = 90;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: unknown };
    if (typeof data.error === "string" && data.error) return data.error;
  } catch {
    /* fall through to the generic message */
  }
  return `The generator responded with ${response.status}.`;
}

function initials(name: string | null, email: string | null): string {
  const source = (name ?? email ?? "O").trim();
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "");
  return letters.join("") || "O";
}

export function Builder() {
  const { user, quota, consume, publish, signOutUser, mode } = useAuth();
  const { push } = useToast();

  const [prompt, setPrompt] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "generating">("idle");
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ id: string; url: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const streaming = status === "generating";
  const remaining = quota?.remaining ?? 0;
  const limit = quota?.limit ?? 5;
  const outOfCredits = remaining <= 0;
  const canGenerate = !streaming && !outOfCredits && prompt.trim().length >= 3;
  const canPublish = Boolean(code) && !streaming && !publishing;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const generate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (trimmed.length < 3) {
      push({
        tone: "error",
        title: "Describe your interface first",
        description: "A sentence is enough — or pick one of the examples below.",
      });
      return;
    }
    if (streaming) return;
    if (outOfCredits) {
      push({
        tone: "error",
        title: "Daily limit reached",
        description: `You get ${limit} free generations per day. Your quota resets at midnight UTC.`,
      });
      return;
    }

    setStatus("generating");
    setCode("");
    setPublished(null);

    let allowed = false;
    try {
      allowed = await consume();
    } catch (error) {
      setStatus("idle");
      push({
        tone: "error",
        title: "Could not reserve a generation",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return;
    }

    if (!allowed) {
      setStatus("idle");
      push({
        tone: "error",
        title: "Daily limit reached",
        description: `You get ${limit} free generations per day. Your quota resets at midnight UTC.`,
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));
      if (!response.body) throw new Error("The generator returned an empty stream.");

      if (response.headers.get("x-openmi-generator") === "demo") {
        push({
          tone: "info",
          title: "Demo generator",
          description: "Add OPENAI_API_KEY to .env.local to stream real AI designs.",
        });
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let lastFlush = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const now = performance.now();
        if (now - lastFlush > STREAM_FLUSH_MS) {
          lastFlush = now;
          setCode(accumulated);
        }
      }
      accumulated += decoder.decode();

      const cleaned = cleanGeneratedHtml(accumulated);
      if (!cleaned) {
        throw new Error("The model returned no usable markup. Try rephrasing your prompt.");
      }
      setCode(cleaned);
      push({
        tone: "success",
        title: "Preview ready",
        description: `${formatBytes(cleaned)} of HTML generated.`,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        // Component unmounted or request cancelled — nothing to report.
      } else if (!accumulated.trim()) {
        push({
          tone: "error",
          title: "Generation failed",
          description: error instanceof Error ? error.message : "Please try again.",
        });
      } else {
        setCode(cleanGeneratedHtml(accumulated));
        push({
          tone: "error",
          title: "Generation stopped early",
          description: error instanceof Error ? error.message : "The stream ended unexpectedly.",
        });
      }
    } finally {
      abortRef.current = null;
      setStatus("idle");
    }
  }, [prompt, streaming, outOfCredits, limit, consume, push]);

  const handlePublish = useCallback(async () => {
    if (!canPublish) return;
    setPublishing(true);
    try {
      const cleaned = cleanGeneratedHtml(code);
      const { id } = await publish(cleaned);
      const url = `${window.location.origin}/p/${id}`;
      setPublished({ id, url });
      try {
        await navigator.clipboard.writeText(url);
        push({ tone: "success", title: "Published and copied", description: url, link: { label: "Open link", href: url } });
      } catch {
        push({
          tone: "success",
          title: "Published",
          description: "Copy the link from the panel on the left.",
        });
      }
    } catch (error) {
      push({
        tone: "error",
        title: "Could not publish",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setPublishing(false);
    }
  }, [canPublish, code, publish, push]);

  const profileName = useMemo(
    () => user?.displayName ?? user?.email?.split("@")[0] ?? "Builder",
    [user],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-950 lg:h-dvh lg:overflow-hidden">
      <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:inline-flex">
            beta
          </span>
          {mode === "demo" ? (
            <span className="rounded-full border border-amber-400/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-amber-300">
              demo
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${streaming ? "bg-amber-400" : "bg-emerald-400"}`} />
            {streaming ? "Generating" : "Ready"}
          </div>
          <div className="group relative">
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="focus-ring flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] py-1.5 pl-1.5 pr-2.5 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
              title="Sign out"
            >
              <Avatar name={profileName} photoURL={user?.photoURL ?? null} size="sm" />
              <span className="hidden max-w-[130px] truncate sm:inline">{profileName}</span>
              <LogOutIcon className="h-3.5 w-3.5 text-slate-500 group-hover:text-slate-300" />
            </button>
          </div>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-3 p-4 lg:grid-cols-[minmax(340px,400px)_1fr] lg:gap-6 lg:overflow-hidden lg:p-6">
        {/* ------------------------------------------------ left panel */}
        <section className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          <div className="surface p-3.5">
            <div className="flex items-center gap-3">
              <Avatar name={profileName} photoURL={user?.photoURL ?? null} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">{profileName}</p>
                <p className="truncate text-xs text-slate-500">{user?.email ?? "Local demo session"}</p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/60 p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                  Daily generations
                </span>
                <span className={`text-sm font-semibold ${outOfCredits ? "text-rose-300" : "text-emerald-300"}`}>
                  {remaining}
                  <span className="text-slate-500"> / {limit}</span>
                </span>
              </div>
              <div className="mt-2.5 flex gap-1.5">
                {Array.from({ length: limit }).map((_, index) => (
                  <span
                    key={index}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      index < remaining ? "bg-emerald-400" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {outOfCredits
                  ? "Limit reached — resets at midnight UTC."
                  : `${remaining === limit ? limit : remaining} request${remaining === 1 ? "" : "s"} left today · resets midnight UTC`}
              </p>
            </div>
          </div>

          <div className="surface p-3.5">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className="text-sm font-medium text-white">
                What do you want to build?
              </label>
              <span className="text-[11px] tabular-nums text-slate-600">
                {prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
            <textarea
              id="prompt"
              value={prompt}
              maxLength={MAX_PROMPT_LENGTH}
              rows={4}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  void generate();
                }
              }}
              placeholder="A landing page for a specialty coffee roaster, with a subscription form, three featured beans and a dark, warm palette…"
              className="focus-ring mt-2.5 min-h-[104px] w-full resize-y rounded-xl border border-white/10 bg-slate-950/70 p-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/40 focus:outline-none"
            />

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PROMPT_EXAMPLES.slice(0, 4).map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setPrompt(example)}
                  className="focus-ring max-w-full truncate rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1 text-[11px] text-slate-400 transition hover:border-emerald-400/30 hover:text-emerald-200"
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!canGenerate}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500"
              >
                {streaming ? (
                  <>
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    Generate UI
                    <kbd className="ml-1 hidden rounded border border-emerald-950/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900/70 sm:inline">
                      ⌘↵
                    </kbd>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={!canPublish}
                className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:text-slate-600"
              >
                {publishing ? (
                  <>
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <LinkIcon className="h-4 w-4" />
                    Publish &amp; copy link
                  </>
                )}
              </button>
            </div>

            {outOfCredits ? (
              <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 p-2.5 text-[11px] leading-relaxed text-rose-200/80">
                You&apos;ve used all {limit} generations for today. The counter resets at midnight UTC;
                you can still publish what you have.
              </p>
            ) : null}
          </div>

          {published ? (
            <div className="surface animate-fade-up p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Published
              </div>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-slate-400">
                {published.url}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(published.url)
                      .then(() => push({ tone: "success", title: "Link copied" }))
                      .catch(() => push({ tone: "error", title: "Copy failed", description: "Select the link above and copy it manually." }));
                  }}
                  className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300 transition hover:border-white/20 hover:text-white"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copy
                </button>
                <a
                  href={published.url}
                  target="_blank"
                  rel="noreferrer"
                  className="focus-ring inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-emerald-950 transition hover:bg-emerald-300"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Open
                </a>
              </div>
            </div>
          ) : null}

          <p className="pb-2 text-center text-[11px] leading-relaxed text-slate-600">
            {mode === "demo"
              ? "Demo mode: generations use a built-in template and quota lives in this browser."
              : "Generated code is stored with your account. Publishing a link makes it public."}
          </p>
        </section>

        {/* ------------------------------------------------ right panel */}
        <PreviewPane code={code} streaming={streaming} className="min-h-[460px] lg:min-h-0" />
      </div>
    </div>
  );
}

function Avatar({
  name,
  photoURL,
  size,
}: {
  name: string;
  photoURL: string | null;
  size: "sm" | "md";
}) {
  const dimension = size === "sm" ? "h-7 w-7 text-[10px]" : "h-10 w-10 text-xs";
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className={`${dimension} rounded-full border border-white/15 object-cover`}
      />
    );
  }
  return (
    <span
      className={`grid ${dimension} shrink-0 place-items-center rounded-full border border-emerald-400/25 bg-emerald-400/10 font-semibold text-emerald-200`}
    >
      {initials(name, null)}
    </span>
  );
}

