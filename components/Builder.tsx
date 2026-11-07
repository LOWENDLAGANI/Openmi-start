"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AiStatus } from "@/lib/ai-config";
import type { ChatFile, ChatMessage, ChatRecord } from "@/lib/backend/types";
import { chatTitle, randomProjectId } from "@/lib/backend/types";
import { PROMPT_EXAMPLES } from "@/lib/prompts";
import { isFirebaseConfigured } from "@/lib/config";
import { activeFilePath, bundleSize, parseFileBundle } from "@/lib/file-bundle";
import { buildInlinePreview, formatBytesNumber } from "@/lib/preview-html";

import { useAuth } from "./AuthProvider";
import {
  ArrowRightIcon,
  CopyIcon,
  ExternalLinkIcon,
  LinkIcon,
  LoaderIcon,
  LogOutIcon,
  MailIcon,
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

export function Builder({ ai, quotaServer }: { ai: AiStatus; quotaServer: boolean }) {
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

  const setupIncomplete = mode === "demo" || !ai.configured;

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

  const quotaLoaded = quota !== null;
  const remaining = quota?.remaining ?? 0;
  const limit = quota?.limit ?? 5;
  const outOfCredits = quotaLoaded && remaining <= 0;
  const canSend = !streaming && quotaLoaded && !outOfCredits && input.trim().length >= 3;
  const hasOutput = files.length > 0;
  const totalSize = useMemo(() => bundleSize(files), [files]);
  const remotePreview = quotaServer && hasOutput ? `/api/preview/${chatId}/` : null;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, streaming]);

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
    setPublished(null);

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

      if (response.headers.get("x-openmi-generator") === "demo") {
        push({
          tone: "info",
          title: "Demo generator",
          description: "Add DEEPSEEK_API_KEY to stream real, researched designs.",
        });
      }
      if (response.headers.get("x-openmi-research") === "grounded") {
        push({
          tone: "info",
          title: "Researched the web",
          description: "Live references and imagery were used for this build.",
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
          paintStream(accumulated);
        }
      }
      accumulated += decoder.decode();

      const bundle = parseFileBundle(accumulated);
      if (!bundle.files.length) {
        throw new Error("The model returned no files. Try rephrasing your request.");
      }

      setFiles(bundle.files);
      setEntry(bundle.entry);
      setLiveHtml(buildInlinePreview(bundle));
      setActiveFile(null);

      // The server charges the credit before it closes the stream, so this
      // re-read already sees the settled counter.
      try {
        if (mode === "demo") await consume();
        else await refreshQuota();
      } catch (error) {
        console.error("[openmi] could not settle the quota", error);
      }

      const summary = `${bundle.files.length} file${bundle.files.length === 1 ? "" : "s"} · ${formatBytesNumber(
        bundleSize(bundle.files),
      )} — ${bundle.files.map((file) => file.path).join(", ")}`;
      const assistantMessage: ChatMessage = { role: "assistant", content: summary, at: Date.now() };
      const nextMessages = [...contextMessages, assistantMessage];
      setMessages(nextMessages);

      const existing = chats.find((chat) => chat.id === chatId);
      try {
        await saveChat({
          id: chatId,
          title: existing?.title ?? chatTitle(instruction),
          entry: bundle.entry,
          files: bundle.files,
          messages: nextMessages,
          createdAt: existing?.createdAt ?? sentAt,
          updatedAt: Date.now(),
          publishedId: null,
        });
      } catch (error) {
        console.error("[openmi] could not save this chat", error);
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

  const openChat = useCallback(
    (chat: ChatRecord) => {
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
    },
    [],
  );

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
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh lg:overflow-hidden">
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Logo />
          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="eyebrow hidden sm:block">Build chat</span>
          <span
            title={
              setupIncomplete
                ? "Demo mode — no Firebase / AI keys in this deployment"
                : `${ai.label} · ${ai.model}${ai.research ? " · research on" : ""}`
            }
            className={`shrink-0 border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] ${
              setupIncomplete
                ? "border-brand/30 bg-brand-tint text-brand-deep"
                : "border-line bg-sand text-inkSoft"
            }`}
          >
            {setupIncomplete ? "Setup" : ai.label}
          </span>
          {ai.research ? (
            <span className="hidden shrink-0 border border-line bg-paperAlt px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-inkSoft sm:inline">
              Research
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={startNewChat} className="btn-quiet h-9 px-3 text-xs">
            New chat
          </button>
          <span className="hidden h-4 w-px bg-line sm:block" />
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="group flex items-center gap-2 rounded-full border border-line bg-paperAlt py-1 pl-1 pr-2.5 transition-colors hover:border-ink"
            title="Sign out"
          >
            <Avatar name={profileName} photoURL={user?.photoURL ?? null} />
            <LogOutIcon className="h-3.5 w-3.5 text-inkSoft transition-colors group-hover:text-ink" />
          </button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 lg:min-h-0 lg:grid-cols-[430px_1fr] lg:overflow-hidden">
        {/* ---------------------------------------------------- chat column */}
        <aside className="flex min-h-0 flex-col border-line bg-paperAlt lg:overflow-hidden lg:border-r">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">
                {chats.find((chat) => chat.id === chatId)?.title ?? "New build"}
              </p>
              <p className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-inkSoft">
                {user?.email ?? "Local demo session"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-inkSoft">
                  Left today
                </span>
                <span className={`display text-xl leading-none ${outOfCredits ? "text-brand" : "text-ink"}`}>
                  {quotaLoaded ? remaining : "—"}
                  <span className="font-mono text-[10px] text-inkSoft">/{limit}</span>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setChatsOpen((open) => !open)}
                aria-expanded={chatsOpen}
                className="btn-quiet h-8 px-3 text-[11px]"
              >
                Chats {chats.length ? `(${chats.length})` : ""}
              </button>
            </div>
          </div>

          {chatsOpen ? (
            <div className="shrink-0 border-b border-line bg-paper p-2">
              {chats.length === 0 ? (
                <p className="p-2 text-[11px] leading-relaxed text-inkSoft">
                  No saved builds yet. Every chat you start is stored here.
                </p>
              ) : (
                <ul className="max-h-56 space-y-1 overflow-y-auto">
                  {chats.map((chat) => (
                    <li key={chat.id}>
                      <button
                        type="button"
                        onClick={() => openChat(chat)}
                        className={`w-full border p-2 text-left transition-colors ${
                          chat.id === chatId
                            ? "border-ink bg-paperAlt"
                            : "border-transparent hover:border-line hover:bg-paperAlt"
                        }`}
                      >
                        <span className="block truncate text-[12px] text-ink">{chat.title}</span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.1em] text-inkSoft">
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

          <div ref={threadRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-[13px] leading-relaxed text-inkSoft">
                  Describe the site you want. You&apos;ll get a small multi-file project — pages, CSS
                  and JS — streaming into the canvas. Then keep chatting to change it.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => setInput(example)}
                      className="chip text-left"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={`${message.at}-${index}`}
                  className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  {message.role === "user" ? (
                    <p className="max-w-[92%] whitespace-pre-wrap border border-ink bg-ink px-3 py-2 text-[12.5px] leading-relaxed text-paper">
                      {message.content}
                    </p>
                  ) : (
                    <div className="max-w-[92%] border border-line bg-paper px-3 py-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-inkSoft">
                        Openmi
                      </span>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink">
                        {message.content ||
                          (streaming && index === messages.length - 1
                            ? activeFile
                              ? `Writing ${activeFile}…`
                              : "Thinking…"
                            : "")}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {user && !user.emailVerified ? (
            <div className="shrink-0 border-t border-line bg-brand-tint/40 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-[11px] text-ink">
                  <MailIcon className="h-3.5 w-3.5 shrink-0 text-brand-deep" />
                  <span className="truncate">Verify {user.email}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void handleResendVerification()}
                    disabled={verifying}
                    className="btn-quiet h-7 px-2 text-[10px]"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCheckedVerification()}
                    disabled={verifying}
                    className="btn-outline h-7 px-2 text-[10px]"
                  >
                    {verifying ? "…" : "Verified"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-line p-3">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
              className="border border-line bg-paper p-2"
            >
              <textarea
                id="chat-input"
                value={input}
                maxLength={MAX_MESSAGE_LENGTH}
                rows={3}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Describe a site, or tell Openmi what to change…"
                className="w-full resize-none border-0 bg-transparent px-1 py-1 text-[12.5px] leading-relaxed text-ink outline-none placeholder:text-inkSoft/70"
              />
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-inkSoft">
                  {streaming ? "Generating…" : "Enter sends · Shift+Enter newline"}
                </span>
                <button type="submit" disabled={!canSend} className="btn-primary h-9 px-3 text-xs">
                  {streaming ? (
                    <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  )}
                  {streaming ? "Writing" : "Send"}
                </button>
              </div>
            </form>

            {outOfCredits ? (
              <p className="mt-2 border border-brand/30 bg-brand-tint p-2 text-[10.5px] leading-relaxed text-brand-deep">
                All {limit} generations used today. The counter resets at midnight UTC; you can still
                publish what you have.
              </p>
            ) : null}

            {hasOutput ? (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || streaming}
                  className="btn-outline h-9 flex-1 text-[11px]"
                >
                  {publishing ? (
                    <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )}
                  {publishing ? "Publishing…" : "Publish"}
                </button>
                {published ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(published.url)
                          .then(() => push({ tone: "success", title: "Link copied" }))
                          .catch(() => push({ tone: "error", title: "Copy failed", description: published.url }));
                      }}
                      className="btn-quiet h-9 px-2.5"
                      title="Copy link"
                    >
                      <CopyIcon className="h-3.5 w-3.5" />
                    </button>
                    <a
                      href={published.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-quiet h-9 px-2.5"
                      title="Open published page"
                    >
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}

            {setupIncomplete ? (
              <SetupNotice firebaseReady={isFirebaseConfigured} ai={ai} quotaServer={quotaServer} />
            ) : null}
          </div>
        </aside>

        {/* ------------------------------------------------------- preview */}
        <PreviewPane
          html={liveHtml}
          src={remotePreview}
          streaming={streaming}
          files={files.map((file) => file.path)}
          size={totalSize}
          className="min-h-[440px] lg:min-h-0"
        />
      </div>
    </div>
  );
}

function SetupNotice({
  firebaseReady,
  ai,
  quotaServer,
}: {
  firebaseReady: boolean;
  ai: AiStatus;
  quotaServer: boolean;
}) {
  const rows = [
    {
      ok: firebaseReady,
      label: "Firebase",
      env: "NEXT_PUBLIC_FIREBASE_*",
      note: "Accounts, chats, quotas and /p/ links",
    },
    {
      ok: ai.configured,
      label: ai.configured ? ai.label : "AI provider",
      env: "DEEPSEEK_API_KEY",
      note: ai.configured ? `${ai.label} · ${ai.model}` : "Without a key, previews use the placeholder",
    },
    {
      ok: quotaServer,
      label: "Server quota + files",
      env: "FIREBASE_SERVICE_ACCOUNT_KEY",
      note: "Charges a credit after success and stores projects in Storage",
    },
    {
      ok: ai.research,
      label: "Live research",
      env: "EXA_API_KEY",
      note: ai.research ? "Web search grounds every build" : "Optional: adds live references and imagery",
    },
  ];

  return (
    <div className="mt-2 border border-brand/20 bg-brand-tint/40 p-2.5">
      <span className="eyebrow flex items-center gap-2 text-brand-deep">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        Setup needed
      </span>
      <ul className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <li key={row.env} className="flex gap-2">
            <span
              className={`mt-0.5 grid h-3 w-3 shrink-0 place-items-center border font-mono text-[8px] leading-none ${
                row.ok ? "border-ink bg-ink text-paper" : "border-line bg-paperAlt text-transparent"
              }`}
              aria-hidden="true"
            >
              ✓
            </span>
            <span className="min-w-0">
              <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-ink">
                {row.label}
              </span>
              <span className="block break-all font-mono text-[9px] leading-relaxed text-inkSoft">
                {row.env} · {row.note}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 font-mono text-[9px] text-inkSoft">README → Production checklist</p>
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
