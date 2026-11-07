"use client";

import { useState } from "react";

import { describeAuthError } from "@/lib/auth-errors";

import { useAuth } from "./AuthProvider";
import { ArrowRightIcon, GoogleIcon, LoaderIcon, LockIcon, MailIcon } from "./icons";
import { Logo } from "./Logo";
import { useToast } from "./Toast";

const STATS = [
  { value: "05", label: "Generations", note: "Free, every day" },
  { value: "00", label: "Build steps", note: "Runs straight in the browser" },
  { value: "<1s", label: "First pixels", note: "Streamed into the preview" },
  { value: "6", label: "Char links", note: "Permanent /p/ share pages" },
];

const STEPS = [
  {
    number: "01",
    title: "Sign in",
    body: "Google or email. Your quota and published work are tied to your account, five generations a day.",
  },
  {
    number: "02",
    title: "Describe the screen",
    body: "A sentence is enough. Openmi writes a small multi-page project — HTML, CSS and JS — into the live preview as it goes, then keeps editing it as you chat.",
  },
  {
    number: "03",
    title: "Publish it",
    body: "Freeze the whole project into a six-character link anyone can open. No containers, no build chain, no billing.",
  },
];

export function Landing() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, mode } = useAuth();
  const { push } = useToast();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | "reset" | null>(null);

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
      // Never confirm whether an address has an account.
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
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Logo />
            <span className="hidden h-4 w-px bg-line sm:block" />
            <span className="eyebrow hidden sm:block">AI front-end builder</span>
          </div>

          <nav className="hidden items-center gap-7 md:flex">
            <a href="#how" className="eyebrow transition-colors hover:text-ink">
              How it works
            </a>
            <a href="#stack" className="eyebrow transition-colors hover:text-ink">
              Stack
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <span className="eyebrow hidden items-center gap-2 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />5 free / day
            </span>
            <a href="#start" className="btn-primary h-9 px-4 text-[13px]">
              Start building <ArrowRightIcon className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1240px] px-5 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
        <div className="grid items-start gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <span className="eyebrow flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Prompt to interface
            </span>

            <h1 className="display mt-6 text-[clamp(2.7rem,6.2vw,4.9rem)]">
              Describe it.
              <br />
              Watch it ship.
            </h1>

            <p className="mt-6 max-w-[38ch] text-[15px] leading-relaxed text-inkSoft sm:text-base">
              Openmi turns a sentence into a working multi-page site. Describe it, watch the files land
              in the preview, keep chatting to refine it, then publish a link in one click.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a href="#start" className="btn-primary h-12 px-6">
                Start building <ArrowRightIcon className="h-4 w-4" />
              </a>
              <a href="#how" className="btn-outline h-12 px-6">
                See how it works
              </a>
            </div>

            <p className="eyebrow mt-7">No card · Multi-page static sites · Runs in the browser</p>
          </div>

          {/* Sign-in, framed as the hero media object. */}
          <div id="start" className="panel-white">
            <div className="flex items-center justify-between border-b border-line bg-paperAlt px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
                <span className="h-2 w-2 rounded-full bg-line" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-inkSoft">
                openmi / sign in
              </span>
              <span className="h-2 w-2 rounded-full bg-brand" />
            </div>

            <div className="p-6 sm:p-8">
              <h2 className="text-xl font-medium tracking-[-0.02em] text-ink">
                {mode === "demo"
                  ? "Try the builder"
                  : tab === "signin"
                    ? "Welcome back"
                    : "Create your account"}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-inkSoft">
                {mode === "demo"
                  ? "No Firebase project attached, so this session runs in local demo mode."
                  : tab === "signin"
                    ? "Sign in to keep your generations and publish links."
                    : "Five free generations a day, no card required."}
              </p>

              {mode === "demo" ? (
                <div className="mt-6 space-y-4">
                  <button
                    type="button"
                    onClick={() => void run("google", signInWithGoogle)}
                    disabled={busy !== null}
                    className="btn-primary h-11 w-full"
                  >
                    {busy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <ArrowRightIcon className="h-4 w-4" />}
                    Continue in demo mode
                  </button>
                  <p className="border border-line bg-paper p-3 font-mono text-[10px] leading-relaxed tracking-[0.02em] text-inkSoft">
                    Placeholder designs stream from the server and quota lives in this browser. Add
                    Firebase keys plus a DEEPSEEK_API_KEY to .env.local for real accounts, quota docs
                    and shareable links.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void run("google", signInWithGoogle)}
                    disabled={busy !== null}
                    className="btn-primary mt-6 h-11 w-full"
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

                  <div className="my-5 flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="eyebrow">or email</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block">
                      <span className="eyebrow">Email</span>
                      <span className="relative mt-2 block">
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
                      <span className="relative mt-2 block">
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

                    <button type="submit" disabled={busy !== null} className="btn-outline h-11 w-full">
                      {busy === "email" ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                      {tab === "signin" ? "Sign in" : "Create account"}
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
      </section>

      <section aria-label="Product numbers" className="border-y border-line bg-paperAlt">
        <dl className="mx-auto grid max-w-[1240px] grid-cols-2 divide-line px-5 sm:grid-cols-4 sm:divide-x sm:px-0">
          {STATS.map((stat) => (
            <div key={stat.label} className="border-b border-line py-7 sm:border-b-0 sm:px-7 sm:py-9">
              <dt className="eyebrow">{stat.label}</dt>
              <dd>
                <p className="stat-value mt-3">{stat.value}</p>
                <p className="mt-2 text-xs text-inkSoft">{stat.note}</p>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="how" className="mx-auto max-w-[1240px] px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-line pb-8">
          <h2 className="display max-w-[20ch] text-[clamp(2rem,4.4vw,3.5rem)]">
            Three steps. No build chain.
          </h2>
          <span className="eyebrow">01 — 03</span>
        </div>

        <div className="grid bg-line sm:grid-cols-3 sm:gap-px">
          {STEPS.map((step) => (
            <article key={step.number} className="bg-paper px-1 py-8 sm:px-7">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-brand">
                {step.number}
              </span>
              <h3 className="mt-4 text-lg font-medium tracking-[-0.01em] text-ink">{step.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-inkSoft">{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="stack" className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-8">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-6">
          <span className="eyebrow">Built on</span>
          {["Next.js", "Firebase Auth", "Firestore", "Tailwind CDN", "Blob preview"].map((item) => (
            <span key={item} className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink">
              {item}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-brand text-white">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-14 sm:px-8 sm:py-20 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="display max-w-[16ch] text-[clamp(2.2rem,5vw,4.2rem)] text-white">
            Prompt in.
            <br />
            Interface out.
          </h2>
          <div className="max-w-sm">
            <p className="text-sm leading-relaxed text-white/85">
              Five free generations every day. Sign in, describe the screen you need, and share it
              before your coffee goes cold.
            </p>
            <a href="#start" className="btn mt-6 h-12 border border-white bg-white px-6 text-ink hover:bg-paper">
              Start building <ArrowRightIcon className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-4 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-4">
            <Logo size="sm" />
            <span className="h-3.5 w-px bg-line" />
            <span className="eyebrow">Single-file UIs, generated on demand</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="eyebrow">Preview runs in your browser</span>
            <span className="eyebrow">© {new Date().getFullYear()} Openmi</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
