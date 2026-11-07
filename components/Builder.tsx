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
        push({
          tone: "success",
          title: "Published and copied",
          description: url,
          link: { label: "Open link", href: url },
        });
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
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh lg:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Logo />
          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="eyebrow hidden sm:block">Builder</span>
          {mode === "demo" ? (
            <span className="border border-line bg-sand px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-inkSoft">
              Demo
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <span className="eyebrow hidden items-center gap-2 sm:flex">
            <span className={`h-1.5 w-1.5 rounded-full ${streaming ? "animate-pulse bg-brand" : "bg-ink"}`} />
            {streaming ? "Generating" : "Ready"}
          </span>
          <span className="hidden h-4 w-px bg-line sm:block" />
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="group flex items-center gap-2 rounded-full border border-line bg-paperAlt py-1 pl-1 pr-2.5 transition-colors hover:border-ink"
            title="Sign out"
          >
            <Avatar name={profileName} photoURL={user?.photoURL ?? null} />
            <span className="hidden max-w-[120px] truncate font-mono text-[10px] uppercase tracking-[0.12em] text-ink sm:inline">
              {profileName}
            </span>
            <LogOutIcon className="h-3.5 w-3.5 text-inkSoft transition-colors group-hover:text-ink" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:grid-cols-[380px_1fr] lg:overflow-hidden">
        {/* ------------------------------------------------ left panel */}
        <aside className="flex flex-col border-line bg-paperAlt lg:min-h-0 lg:overflow-y-auto lg:border-r">
          <div className="border-b border-line p-5">
            <div className="flex items-center gap-3">
              <Avatar name={profileName} photoURL={user?.photoURL ?? null} large />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{profileName}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-inkSoft">
                  {user?.email ?? "Local demo session"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <span className="eyebrow">Generations left today</span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-inkSoft">
                00:00 UTC
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className={`display text-[2.75rem] leading-none ${outOfCredits ? "text-brand" : "text-ink"}`}>
                {remaining}
              </span>
              <span className="font-mono text-xs text-inkSoft">/ {limit}</span>
            </div>
            <div className="mt-3 flex gap-1">
              {Array.from({ length: limit }).map((_, index) => (
                <span
                  key={index}
                  className={`h-1 flex-1 ${index < remaining ? "bg-ink" : "bg-sand"}`}
                />
              ))}
            </div>
          </div>

          <div className="border-b border-line p-5">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className="eyebrow">
                01 / What do you want to build?
              </label>
              <span className="font-mono text-[10px] tabular-nums text-inkSoft">
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
              placeholder="A landing page for a specialty coffee roaster, with a subscription form, three featured beans and a warm palette…"
              className="field mt-3 min-h-[104px] resize-y leading-relaxed"
            />

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PROMPT_EXAMPLES.slice(0, 4).map((example) => (
                <button key={example} type="button" onClick={() => setPrompt(example)} className="chip">
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-line p-5">
            <span className="eyebrow">02 / Generate</span>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                onClick={() => void generate()}
                disabled={!canGenerate}
                className="btn-primary h-12 w-full"
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
                    <span className="ml-1 font-mono text-[10px] tracking-[0.1em] opacity-70">⌘↵</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={!canPublish}
                className="btn-outline h-11 w-full"
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
              <p className="mt-3 border border-brand/30 bg-brand-tint p-2.5 text-[11px] leading-relaxed text-brand-deep">
                You&apos;ve used all {limit} generations for today. The counter resets at midnight UTC;
                you can still publish what you have.
              </p>
            ) : null}
          </div>

          {published ? (
            <div className="animate-fade-up border-b border-line p-5">
              <span className="eyebrow flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                Published link
              </span>
              <p className="mt-2 break-all font-mono text-[11px] leading-relaxed text-ink">
                {published.url}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(published.url)
                      .then(() => push({ tone: "success", title: "Link copied" }))
                      .catch(() =>
                        push({
                          tone: "error",
                          title: "Copy failed",
                          description: "Select the link above and copy it manually.",
                        }),
                      );
                  }}
                  className="btn-quiet h-9 flex-1 text-xs"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copy
                </button>
                <a
                  href={published.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary h-9 flex-1 text-xs"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                  Open
                </a>
              </div>
            </div>
          ) : null}

          <p className="mt-auto p-5 font-mono text-[10px] leading-relaxed tracking-[0.02em] text-inkSoft">
            {mode === "demo"
              ? "Demo mode: placeholder generations, quota stored in this browser."
              : "Generated code is stored with your account. Publishing makes a link public."}
          </p>
        </aside>

        {/* ------------------------------------------------ right panel */}
        <PreviewPane code={code} streaming={streaming} className="min-h-[440px] lg:min-h-0" />
      </div>
    </div>
  );
}

function Avatar({
  name,
  photoURL,
  large = false,
}: {
  name: string;
  photoURL: string | null;
  large?: boolean;
}) {
  const dimension = large ? "h-10 w-10 text-xs" : "h-6 w-6 text-[9px]";
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        referrerPolicy="no-referrer"
        className={`${dimension} rounded-full border border-line object-cover`}
      />
    );
  }
  return (
    <span
      className={`grid ${dimension} shrink-0 place-items-center rounded-full bg-ink font-mono font-medium uppercase text-paper`}
    >
      {initials(name, null)}
    </span>
  );
}
