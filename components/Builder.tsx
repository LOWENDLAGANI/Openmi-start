"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ChatFile, ChatMessage, ChatRecord } from "@/lib/backend/types";
import { chatTitle, randomProjectId } from "@/lib/backend/types";
import { PROMPT_EXAMPLES } from "@/lib/prompts";
import { PENDING_PROMPT_KEY } from "@/lib/config";
import { activeFilePath, bundleSize, parseFileBundle } from "@/lib/file-bundle";
import { buildInlinePreview, formatBytesNumber } from "@/lib/preview-html";

import { useAuth } from "./AuthProvider";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  CopyIcon,
  ExternalLinkIcon,
  LoaderIcon,
  PlusIcon,
} from "./icons";
import { Logo } from "./Logo";
import { PreviewPane } from "./PreviewPane";
import { useToast } from "./Toast";

const MAX_MESSAGE_LENGTH = 4000;
const STREAM_FLUSH_MS = 110;

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

function relativeTime(timestamp: number): string {
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;
  const diff = Date.now() - timestamp;
  if (diff < minute) return "just now";
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

export function Builder({ quotaServer }: { quotaServer: boolean }) {
  const {
    user,
    quota,
    chats,
    mode,
    consume,
    publish,
    signOutUser,
    getIdToken,
    refreshQuota,
    saveChat,
    refreshUser,
    resendVerificationEmail,
  } = useAuth();
  const { push } = useToast();

  const [chatId, setChatId] = useState(() => randomProjectId(20));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [files, setFiles] = useState<ChatFile[]>([]);
  const [entry, setEntry] = useState("index.html");
  const [liveHtml, setLiveHtml] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<{ id: string; url: string } | null>(null);
  const [chatsOpen, setChatsOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const quotaLoaded = quota !== null;
  const remaining = quota?.remaining ?? 0;
  const limit = quota?.limit ?? 5;
  const outOfCredits = quotaLoaded && remaining <= 0;
  const canSend = !streaming && quotaLoaded && !outOfCredits && input.trim().length >= 3;
  const hasOutput = files.length > 0;
  const totalSize = useMemo(() => bundleSize(files), [files]);
  const remotePreview = quotaServer && hasOutput ? `/api/preview/${chatId}/` : null;
  const currentChat = chats.find((chat) => chat.id === chatId);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // A prompt typed on the landing page before signing in lands in the composer.
  useEffect(() => {
    try {
      const pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_PROMPT_KEY);
        setInput(pending);
      }
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!chatsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setChatsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setChatsOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [chatsOpen]);

  const paintStream = useCallback((raw: string) => {
    const partial = parseFileBundle(raw);
    if (partial.files.length) {
      setLiveHtml(buildInlinePreview(partial));
      setFiles(partial.files);
      setEntry(partial.entry);
    }
    setActiveFile(activeFilePath(raw));
  }, []);

  const send = useCallback(async () => {
    const instruction = input.trim();
    if (instruction.length < 3) {
      push({
        tone: "error",
        title: "Say what you want",
        description: "A sentence is enough — describe the site or the change you need.",
      });
      return;
    }
    if (streaming || !quotaLoaded) return;
    if (outOfCredits) {
      push({
        tone: "error",
        title: "Daily limit reached",
        description: `You get ${limit} generations per day. Your quota resets at midnight UTC.`,
      });
      return;
    }

    const sentAt = Date.now();
    const userMessage: ChatMessage = { role: "user", content: instruction, at: sentAt };
    const contextMessages = [...messages, userMessage];

    setMessages([...contextMessages, { role: "assistant", content: "", at: sentAt + 1 }]);
    setInput("");
    setStreaming(true);

    const token = await getIdToken().catch(() => null);
    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = "";

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: token
          ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
          : { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: instruction,
          chatId,
          files,
          history: contextMessages.slice(-8).map(({ role, content }) => ({ role, content })),
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(await readErrorMessage(response));
      if (!response.body) throw new Error("The generator returned an empty stream.");

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
          paintStream(accumulated);
        }
      }
      accumulated += decoder.decode();

      const bundle = parseFileBundle(accumulated);
      const existing = chats.find((chat) => chat.id === chatId);
      const now = Date.now();

      let nextFiles = files;
      let nextEntry = entry;
      let assistantMessage: ChatMessage;

      if (bundle.files.length) {
        nextFiles = bundle.files;
        nextEntry = bundle.entry;
        setFiles(bundle.files);
        setEntry(bundle.entry);
        setLiveHtml(buildInlinePreview(bundle));
        setActiveFile(null);

        // The server charged the credit before it closed the stream, so this
        // re-read already sees the settled counter.
        try {
          if (mode === "demo") await consume();
          else await refreshQuota();
        } catch (error) {
          console.error("[openmi] could not settle the quota", error);
        }

        assistantMessage = {
          role: "assistant",
          content: `${bundle.files.length} file${bundle.files.length === 1 ? "" : "s"} · ${formatBytesNumber(
            bundleSize(bundle.files),
          )} — ${bundle.files.map((file) => file.path).join(", ")}`,
          at: now,
        };
      } else {
        // No files: the model answered or asked a question instead of building.
        // The server stored and charged nothing, so show the reply as chat text.
        const reply = accumulated.trim().slice(0, 6000);
        if (!reply) throw new Error("The model returned nothing usable. Try rephrasing your request.");
        assistantMessage = { role: "assistant", content: reply, at: now };
      }

      const nextMessages = [...contextMessages, assistantMessage];
      setMessages(nextMessages);

      try {
        await saveChat({
          id: chatId,
          title: existing?.title ?? chatTitle(instruction),
          entry: nextEntry,
          files: nextFiles,
          messages: nextMessages,
          createdAt: existing?.createdAt ?? sentAt,
          updatedAt: now,
          publishedId: existing?.publishedId ?? null,
        });
      } catch (error) {
        console.error("[openmi] could not save this chat", error);
        // The canvas and the credit are already spent, so this must be visible:
        // otherwise a rules/network problem silently loses the build.
        push({
          tone: "error",
          title: "This build wasn't saved",
          description: "The preview works, but it won't appear under Projects until the save succeeds.",
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Please try again.";
      push({ tone: "error", title: "Generation failed", description: message });
      setMessages((previous) =>
        previous.map((item, index) =>
          index === previous.length - 1 && item.role === "assistant" && !item.content
            ? { ...item, content: `Failed — ${message}` }
            : item,
        ),
      );
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setActiveFile(null);
    }
  }, [
    input,
    streaming,
    quotaLoaded,
    outOfCredits,
    limit,
    messages,
    chatId,
    files,
    entry,
    mode,
    chats,
    getIdToken,
    consume,
    refreshQuota,
    saveChat,
    paintStream,
    push,
  ]);

  const startNewChat = useCallback(() => {
    abortRef.current?.abort();
    setChatId(randomProjectId(20));
    setMessages([]);
    setFiles([]);
    setEntry("index.html");
    setLiveHtml(null);
    setInput("");
    setPublished(null);
    setChatsOpen(false);
  }, []);

  const openChat = useCallback((chat: ChatRecord) => {
    abortRef.current?.abort();
    setChatId(chat.id);
    setMessages(chat.messages);
    setFiles(chat.files);
    setEntry(chat.entry);
    setLiveHtml(chat.files.length ? buildInlinePreview({ entry: chat.entry, files: chat.files }) : null);
    setPublished(
      chat.publishedId
        ? { id: chat.publishedId, url: `${window.location.origin}/p/${chat.publishedId}` }
        : null,
    );
    setChatsOpen(false);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!hasOutput || streaming || publishing) return;
    setPublishing(true);
    try {
      const { id } = await publish({ chatId, entry });
      const url = `${window.location.origin}/p/${id}`;
      setPublished({ id, url });

      const existing = chats.find((chat) => chat.id === chatId);
      if (existing) {
        await saveChat({ ...existing, publishedId: id, updatedAt: Date.now() }).catch((error: unknown) => {
          console.error("[openmi] could not mark the chat published", error);
        });
      }

      try {
        await navigator.clipboard.writeText(url);
        push({ tone: "success", title: "Published and copied", description: url, link: { label: "Open", href: url } });
      } catch {
        push({ tone: "success", title: "Published", description: "Copy the link from the panel below." });
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
  }, [hasOutput, streaming, publishing, publish, chatId, entry, chats, saveChat, push]);

  const handleResendVerification = useCallback(async () => {
    try {
      await resendVerificationEmail();
      push({
        tone: "success",
        title: "Verification email sent",
        description: "Open the link in your inbox, then press “I've verified”.",
      });
    } catch (error) {
      push({
        tone: "error",
        title: "Could not send the email",
        description: error instanceof Error ? error.message : "Try again shortly.",
      });
    }
  }, [resendVerificationEmail, push]);

  const handleCheckedVerification = useCallback(async () => {
    setVerifying(true);
    try {
      const next = await refreshUser();
      if (next?.emailVerified) {
        push({ tone: "success", title: "Email verified", description: "Your account is confirmed." });
      } else {
        push({
          tone: "info",
          title: "Not verified yet",
          description: "Open the link from the email first, then check again.",
        });
      }
    } finally {
      setVerifying(false);
    }
  }, [refreshUser, push]);

  const profileName = useMemo(
    () => user?.displayName ?? user?.email?.split("@")[0] ?? "Builder",
    [user],
  );

  return (
    <div className="relative flex min-h-dvh flex-col bg-[#0B0B0D] text-white/90 lg:h-dvh lg:overflow-hidden">
      {/* ------------------------------------------------------------- header */}
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-2 border-b border-white/10 px-2 sm:px-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Logo href="/" showWordmark={false} size="sm" />
          <span className="h-4 w-px shrink-0 bg-white/10" />
          <div className="relative min-w-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setChatsOpen((open) => !open)}
              aria-expanded={chatsOpen}
              className="group flex min-w-0 max-w-[46vw] items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-white/85 transition-colors hover:bg-white/[0.06] sm:max-w-[280px]"
            >
              <span className="truncate">{currentChat?.title ?? "New build"}</span>
              <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-white/40 transition-transform group-hover:text-white/70" />
            </button>

            {chatsOpen ? (
              <div className="absolute left-0 top-9 z-30 w-[290px] overflow-hidden rounded-xl border border-white/12 bg-[#15151A] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.9)]">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <span className="text-[11px] font-medium text-white/70">
                    Projects{chats.length ? ` · ${chats.length}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={startNewChat}
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    <PlusIcon className="h-3 w-3" />
                    New
                  </button>
                </div>
                {chats.length === 0 ? (
                  <p className="px-3 py-4 text-[11.5px] leading-relaxed text-white/40">
                    No saved builds yet. Every chat you start shows up here.
                  </p>
                ) : (
                  <ul className="max-h-72 overflow-y-auto p-1.5">
                    {chats.map((chat) => (
                      <li key={chat.id}>
                        <button
                          type="button"
                          onClick={() => openChat(chat)}
                          className={`w-full rounded-lg px-2 py-1.5 text-left transition-colors ${
                            chat.id === chatId ? "bg-white/10" : "hover:bg-white/[0.06]"
                          }`}
                        >
                          <span className="block truncate text-[12.5px] text-white/85">{chat.title}</span>
                          <span className="mt-0.5 block text-[10px] text-white/35">
                            {relativeTime(chat.updatedAt)} · {chat.files.length} files
                            {chat.publishedId ? " · published" : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!hasOutput || streaming || publishing}
            title={hasOutput ? "Publish this project" : "Build something first"}
            className={`flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[12px] font-medium transition-colors ${
              !hasOutput || streaming || publishing
                ? "cursor-not-allowed bg-white/10 text-white/30"
                : "bg-[#EDEDF0] text-[#0B0B0D] hover:bg-white"
            }`}
          >
            {publishing ? <LoaderIcon className="h-3.5 w-3.5 animate-spin" /> : null}
            {publishing ? "Publishing" : "Publish"}
          </button>
          <button
            type="button"
            onClick={() => void signOutUser()}
            title="Sign out"
            className="group grid h-8 w-8 place-items-center rounded-full transition-colors hover:bg-white/10"
          >
            <Avatar name={profileName} photoURL={user?.photoURL ?? null} />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[minmax(360px,42%)_1fr] lg:overflow-hidden">
        {/* ------------------------------------------------------- chat column */}
        <aside className="flex min-h-0 flex-col lg:overflow-hidden lg:border-r lg:border-white/10">
          <div ref={threadRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="max-w-[38ch] text-[13px] leading-relaxed text-white/55">
                  Describe the site you want. A small multi-file project — pages, CSS and JS — streams
                  into the canvas. Then keep chatting to change it.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setInput(example)}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-left text-[11px] text-white/60 transition-colors hover:border-white/25 hover:bg-white/[0.08] hover:text-white"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const isUser = message.role === "user";
                const pending = !isUser && !message.content && streaming && index === messages.length - 1;

                return (
                  <div key={`${message.at}-${index}`} className={isUser ? "flex justify-end" : "flex gap-2.5"}>
                    {!isUser ? (
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#F43E01]" />
                      </span>
                    ) : null}
                    {isUser ? (
                      <p className="max-w-[88%] whitespace-pre-wrap rounded-2xl border border-white/[0.07] bg-[#1B1B20] px-3.5 py-2 text-[13px] leading-relaxed text-white/85">
                        {message.content}
                      </p>
                    ) : (
                      <p className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5 text-[13px] leading-relaxed text-white/75">
                        {pending ? (
                          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/40">
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                            {activeFile ? `Writing ${activeFile}` : "Thinking"}
                          </span>
                        ) : (
                          message.content
                        )}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ---------------------------------------------------- composer */}
          <div className="shrink-0 px-3 pb-3 pt-1 sm:px-4">
            {user && !user.emailVerified ? (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5">
                <span className="truncate text-[11px] text-white/45">Verify {user.email}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={verifying}
                    className="text-[11px] text-white/55 underline decoration-white/20 underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCheckedVerification()}
                    disabled={verifying}
                    className="text-[11px] text-white/80 underline decoration-white/30 underline-offset-2 transition-colors hover:text-white disabled:opacity-50"
                  >
                    {verifying ? "Checking…" : "I've verified"}
                  </button>
                </span>
              </div>
            ) : null}

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="rounded-[20px] border border-white/12 bg-[#151518] p-2 transition-colors focus-within:border-white/25"
            >
              <textarea
                id="chat-input"
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={2}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Ask Openmi to build a landing page for…"
                className="w-full resize-none border-0 bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/30"
              />
              <div className="mt-1 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={startNewChat}
                  title="New project"
                  className="grid h-7 w-7 place-items-center rounded-full border border-white/12 text-white/50 transition-colors hover:border-white/25 hover:text-white"
                >
                  <PlusIcon className="h-3.5 w-3.5" />
                </button>
                <span className="truncate pl-1 text-[11px] text-white/35">
                  {quotaLoaded ? `${remaining} of ${limit} builds left today` : "Checking credits…"}
                </span>
                <span className="flex-1" />
                <button
                  type="submit"
                  disabled={!canSend}
                  title={outOfCredits ? "Daily limit reached" : "Send"}
                  className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${
                    canSend
                      ? "bg-[#EDEDF0] text-[#0B0B0D] hover:bg-white"
                      : "cursor-not-allowed bg-white/10 text-white/30"
                  }`}
                >
                  {streaming ? (
                    <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </form>

            {outOfCredits ? (
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-white/40">
                All {limit} builds used today. The counter resets at midnight UTC; you can still publish
                what you have.
              </p>
            ) : null}

            {published ? (
              <div className="mt-2 flex items-center gap-1.5 px-1">
                <span className="min-w-0 flex-1 truncate font-mono text-[10.5px] text-white/40">
                  {published.url}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(published.url)
                      .then(() => push({ tone: "success", title: "Link copied" }))
                      .catch(() => push({ tone: "error", title: "Copy failed", description: published.url }));
                  }}
                  title="Copy link"
                  className="grid h-6 w-6 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <CopyIcon className="h-3.5 w-3.5" />
                </button>
                <a
                  href={published.url}
                  target="_blank"
                  rel="noreferrer"
                  title="Open published page"
                  className="grid h-6 w-6 place-items-center rounded-md text-white/45 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : null}
          </div>
        </aside>

        {/* ----------------------------------------------------------- preview */}
        <PreviewPane
          html={liveHtml}
          src={remotePreview}
          streaming={streaming}
          files={files.map((file) => file.path)}
          size={totalSize}
          shareUrl={published?.url ?? null}
          className="m-2 min-h-[360px] sm:m-3 lg:min-h-0"
        />
      </div>
    </div>
  );
}

function Avatar({ name, photoURL }: { name: string; photoURL: string | null }) {
  if (photoURL) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoURL} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
    );
  }
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full bg-white/15 font-mono text-[9px] font-medium uppercase text-white">
      {initials(name, null)}
    </span>
  );
}
