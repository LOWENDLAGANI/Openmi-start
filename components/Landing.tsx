"use client";

import { useEffect, useRef, useState } from "react";

import { describeAuthError } from "@/lib/auth-errors";
import { PENDING_PROMPT_KEY } from "@/lib/config";

import { useAuth } from "./AuthProvider";
import { ArrowRightIcon, GoogleIcon, LoaderIcon, LockIcon, MailIcon, SparklesIcon } from "./icons";
import { Logo } from "./Logo";
import { useToast } from "./Toast";

const FEATURES = [
  {
    number: "01",
    title: "Multi-page projects",
    body: "HTML, CSS and JS as separate files — real pages with real links between them, plus a live preview while they stream in.",
  },
  {
    number: "02",
    title: "Grounded in the live web",
    body: "A research pass pulls current references, palette cues and image URLs into every build, so pages look sourced, not invented.",
  },
  {
    number: "03",
    title: "Refine in chat",
    body: "Keep talking. Each message rewrites the project in place — swap the palette, add a section, turn one page into five.",
  },
  {
    number: "04",
    title: "One link to ship",
    body: "Publish the whole project behind a six-character URL. It opens for anyone, no install, no build chain.",
  },
];

/** Short chip labels with the full prompt behind them. */
const HERO_EXAMPLES = [
  {
    label: "Coffee roaster",
    prompt: "A three-page site for a specialty coffee roaster, warm and editorial",
  },
  { label: "Film composer", prompt: "A dark, cinematic portfolio for a film composer" },
  {
    label: "Analytics dashboard",
    prompt: "SaaS analytics dashboard with a sidebar, KPI cards and a usage chart",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Describe it",
    body: "A sentence is enough — the product, the mood and anything it must include.",
  },
  {
    number: "02",
    title: "Watch the files land",
    body: "Pages, styles and scripts stream into the canvas. Corrections are just more chat.",
  },
  {
    number: "03",
    title: "Publish the project",
    body: "One click freezes it behind a shareable link you can paste anywhere.",
  },
];

export function Landing() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, mode } = useAuth();
  const { push } = useToast();

  const [draft, setDraft] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!dialogOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialogOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialogOpen]);

  function start() {
    const text = draft.trim();
    if (text.length < 3) {
      push({
        tone: "error",
        title: "Describe the site first",
        description: "One sentence is enough — or tap an example below the composer.",
      });
      composerRef.current?.focus();
      return;
    }
    try {
      sessionStorage.setItem(PENDING_PROMPT_KEY, text);
    } catch {
      /* private mode: the prompt just won't carry over */
    }
    setDialogOpen(true);
  }

  async function run(kind: "google" | "email", action: () => Promise<void>) {
    setBusy(kind);
    try {
      await action();
    } catch (error) {
      push({ tone: "error", title: "Sign-in failed", description: describeAuthError(error) });
    } finally {
      setBusy(null);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || password.length < 6) {
      push({
        tone: "error",
        title: "Check your details",
        description: "Enter a valid email and a password of at least 6 characters.",
      });
      return;
    }
    void run("email", () =>
      tab === "signin" ? signInWithEmail(email, password) : signUpWithEmail(email, password),
    );
  }

  async function handleReset() {
    if (!email.trim()) {
      push({
        tone: "error",
        title: "Enter your email first",
        description: "Type the address you signed up with, then request the reset link.",
      });
      return;
    }
    setBusy("reset");
    try {
      await sendPasswordReset(email);
      push({
        tone: "success",
        title: "Reset link sent",
        description: `Check ${email.trim()} for a link to choose a new password.`,
      });
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (code === "auth/user-not-found") {
        push({
          tone: "info",
          title: "If that account exists",
          description: "A reset link is on its way. Check your inbox and spam folder.",
        });
      } else {
        push({ tone: "error", title: "Could not send the reset link", description: describeAuthError(error) });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-paper text-ink">
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-[13px] text-inkSoft transition-colors hover:text-ink">
              What you get
            </a>
            <a href="#how" className="text-[13px] text-inkSoft transition-colors hover:text-ink">
              How it works
            </a>
            <a href="#stack" className="text-[13px] text-inkSoft transition-colors hover:text-ink">
              Stack
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setTab("signin");
                setDialogOpen(true);
              }}
              className="hidden h-9 items-center rounded-full px-3.5 text-[13px] text-inkSoft transition-colors hover:text-ink sm:flex"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setDialogOpen(true);
              }}
              className="btn-primary h-9 px-4 text-[13px]"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* ---------------------------------------------------------- hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-[0.5]"
          style={{
            background:
              "radial-gradient(60% 55% at 50% 0%, rgba(244,62,1,0.16) 0%, rgba(244,62,1,0.05) 45%, rgba(243,243,238,0) 100%), radial-gradient(45% 40% at 82% 18%, rgba(90,72,255,0.10) 0%, rgba(243,243,238,0) 70%)",
          }}
        />

        <div className="relative mx-auto max-w-[1180px] px-5 pb-14 pt-14 sm:px-8 sm:pb-20 sm:pt-24">
          <div className="mx-auto max-w-[46rem] text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paperAlt/80 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-inkSoft">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Multi-page builds · live web research
            </span>

            <h1 className="display mt-6 text-[clamp(2.5rem,7.4vw,4.9rem)] leading-[0.94]">
              Describe it.
              <br />
              Ship the whole site.
            </h1>

            <p className="mx-auto mt-5 max-w-[38ch] text-[15px] leading-relaxed text-inkSoft sm:text-[17px]">
              Openmi writes a real multi-page project — pages, CSS and JS — then keeps editing it
              while you chat. Publish the result in one click.
            </p>
          </div>

          {/* The composer is the hero, as on bolt.new / lovable. */}
          <div className="mx-auto mt-9 max-w-[46rem] sm:mt-11">
            <div className="rounded-[22px] border border-line bg-paperAlt p-1.5 shadow-[0_18px_50px_-28px_rgba(48,43,40,0.45)]">
              <div className="rounded-[17px] bg-paper px-4 pb-3 pt-4">
                <label htmlFor="hero-prompt" className="sr-only">
                  Describe the site you want to build
                </label>
                <textarea
                  ref={composerRef}
                  id="hero-prompt"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      start();
                    }
                  }}
                  rows={2}
                  maxLength={4000}
                  placeholder="A three-page site for a specialty coffee roaster, warm and editorial…"
                  className="w-full resize-none border-0 bg-transparent p-0 text-[15px] leading-relaxed text-ink outline-none placeholder:text-inkSoft/70 sm:text-base"
                />

                <div className="mt-2 flex items-end justify-between gap-3">
                  <span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-inkSoft">
                    <SparklesIcon className="h-3.5 w-3.5 text-brand" />
                    {mode === "demo" ? "Demo generator" : "DeepSeek Flash"}
                  </span>
                  <button type="button" onClick={start} className="btn-primary h-10 shrink-0 px-4 text-[13px]">
                    Build
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
              {HERO_EXAMPLES.map((example) => (
                <button
                  key={example.label}
                  type="button"
                  onClick={() => setDraft(example.prompt)}
                  className="chip text-[11px]"
                  title={example.prompt}
                >
                  {example.label}
                </button>
              ))}
            </div>

            <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-inkSoft">
              5 free builds a day · no card · publish a link
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ features */}
      <section id="features" className="border-y border-line bg-paperAlt">
        <div className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="display max-w-[22ch] text-[clamp(1.8rem,4vw,2.8rem)]">
              A builder that keeps up with the edits.
            </h2>
            <span className="eyebrow">What you get</span>
          </div>

          <div className="mt-10 grid gap-px bg-line sm:grid-cols-2">
            {FEATURES.map((feature) => (
              <article key={feature.number} className="bg-paperAlt p-6 sm:p-7">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
                  {feature.number}
                </span>
                <h3 className="mt-3 text-lg font-medium tracking-[-0.01em] text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-inkSoft">{feature.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------- how */}
      <section id="how" className="mx-auto max-w-[1180px] px-5 py-14 sm:px-8 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div>
            <span className="eyebrow">How it works</span>
            <h2 className="display mt-4 text-[clamp(1.9rem,4.2vw,3rem)]">
              Three steps.
              <br />
              No build chain.
            </h2>
            <p className="mt-4 max-w-[34ch] text-sm leading-relaxed text-inkSoft">
              Everything runs in the browser: the model streams files, the preview resolves them, and
              publishing stores the project behind a short link.
            </p>
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setDialogOpen(true);
              }}
              className="btn-primary mt-6 h-11 px-5 text-[13px]"
            >
              Start building
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <ol className="space-y-4">
            {STEPS.map((step) => (
              <li key={step.number} className="flex gap-4 border border-line bg-paperAlt p-5">
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-brand">
                  {step.number}
                </span>
                <div>
                  <h3 className="text-[15px] font-medium text-ink">{step.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-inkSoft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --------------------------------------------------------- stack */}
      <section id="stack" className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-8 gap-y-3 px-5 py-7 sm:px-8">
          <span className="eyebrow">Built on</span>
          {["Next.js", "Firebase", "Firestore", "Storage", "DeepSeek", "Exa research"].map((item) => (
            <span key={item} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-brand text-white">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="display max-w-[16ch] text-[clamp(2.2rem,5vw,4.2rem)] text-white">
            Idea in.
            <br />
            Website out.
          </h2>
          <div className="max-w-sm">
            <p className="text-sm leading-relaxed text-white/85">
              Five free builds every day. Describe the site, refine it in chat, and share it before
              your coffee goes cold.
            </p>
            <button
              type="button"
              onClick={() => {
                setTab("signup");
                setDialogOpen(true);
              }}
              className="mt-6 inline-flex h-12 items-center gap-2 rounded-full border border-white bg-white px-6 text-[13px] font-medium text-ink transition-colors hover:bg-paper"
            >
              Build something
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="h-3.5 w-px bg-line" />
            <span className="eyebrow">Describe it, chat it, ship it</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="eyebrow">© {new Date().getFullYear()} Openmi</span>
          </div>
        </div>
      </footer>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="Sign in to Openmi"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDialogOpen(false);
          }}
        >
          <div className="max-h-[90dvh] w-full max-w-[420px] overflow-y-auto border border-line bg-paperAlt shadow-[0_30px_80px_-30px_rgba(48,43,40,0.6)]">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-inkSoft">
                {mode === "demo" ? "openmi / demo" : tab === "signin" ? "openmi / sign in" : "openmi / create account"}
              </span>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                aria-label="Close"
                className="grid h-7 w-7 place-items-center rounded-full border border-line text-inkSoft transition-colors hover:border-ink hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">
                {mode === "demo"
                  ? "Try the builder"
                  : tab === "signin"
                    ? "Welcome back"
                    : "Create your account"}
              </h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-inkSoft">
                {mode === "demo"
                  ? "No Firebase project attached, so this session runs in local demo mode."
                  : tab === "signin"
                    ? "Sign in and your prompt starts building right away."
                    : "Five free builds a day. Your work stays tied to your account."}
              </p>

              {mode === "demo" ? (
                <div className="mt-5 space-y-3">
                  <button
                    type="button"
                    onClick={() => void run("google", signInWithGoogle)}
                    disabled={busy !== null}
                    className="btn-primary h-11 w-full"
                  >
                    {busy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <ArrowRightIcon className="h-4 w-4" />}
                    Continue in demo mode
                  </button>
                  <p className="border border-line bg-paper p-3 font-mono text-[10px] leading-relaxed text-inkSoft">
                    Placeholder projects stream from the server and quota lives in this browser. Add
                    Firebase + a DEEPSEEK_API_KEY to .env.local for real accounts and storage.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void run("google", signInWithGoogle)}
                    disabled={busy !== null}
                    className="btn-outline mt-5 h-11 w-full"
                  >
                    {busy === "google" ? (
                      <LoaderIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-white">
                        <GoogleIcon className="h-3.5 w-3.5" />
                      </span>
                    )}
                    Continue with Google
                  </button>

                  <div className="my-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="eyebrow">or email</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block">
                      <span className="eyebrow">Email</span>
                      <span className="relative mt-1.5 block">
                        <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkSoft" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@company.com"
                          className="field pl-9"
                        />
                      </span>
                    </label>
                    <label className="block">
                      <span className="flex items-center justify-between gap-3">
                        <span className="eyebrow">Password</span>
                        {tab === "signin" ? (
                          <button
                            type="button"
                            onClick={() => void handleReset()}
                            disabled={busy !== null}
                            className="font-mono text-[10px] uppercase tracking-[0.1em] text-inkSoft underline underline-offset-4 transition-colors hover:text-ink disabled:opacity-50"
                          >
                            {busy === "reset" ? "Sending…" : "Forgot?"}
                          </button>
                        ) : null}
                      </span>
                      <span className="relative mt-1.5 block">
                        <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-inkSoft" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          autoComplete={tab === "signin" ? "current-password" : "new-password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="At least 6 characters"
                          className="field pl-9"
                        />
                      </span>
                    </label>

                    <button type="submit" disabled={busy !== null} className="btn-primary h-11 w-full">
                      {busy === "email" ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                      {tab === "signin" ? "Sign in and build" : "Create account"}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-xs text-inkSoft">
                    {tab === "signin" ? "New to Openmi?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setTab(tab === "signin" ? "signup" : "signin")}
                      className="font-medium text-ink underline decoration-brand decoration-2 underline-offset-4"
                    >
                      {tab === "signin" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
