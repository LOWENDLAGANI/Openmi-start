"use client";

import { useState } from "react";

import { describeAuthError } from "@/lib/auth-errors";

import { useAuth } from "./AuthProvider";
import { ArrowRightIcon, GoogleIcon, LoaderIcon, LockIcon, MailIcon, SparklesIcon } from "./icons";
import { Logo } from "./Logo";
import { useToast } from "./Toast";

const FEATURES = [
  {
    title: "Prompt to pixels in seconds",
    body: "Describe a screen. Tokens stream straight into a sandboxed preview, so the layout builds itself while you watch.",
  },
  {
    title: "Real HTML + Tailwind",
    body: "Every generation is a single, self-contained file with the Tailwind CDN — no build step, no black box.",
  },
  {
    title: "Publish with one click",
    body: "Freeze a design into a permanent /p/ link you can send to a client, a teammate or your future self.",
  },
];

export function Landing() {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, mode } = useAuth();
  const { push } = useToast();

  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"google" | "email" | null>(null);

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

  return (
    <main className="relative min-h-dvh overflow-hidden bg-slate-950">
      {/* ambient background */}
      <div className="pointer-events-none absolute -top-52 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute inset-0 bg-dotgrid opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />

      <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 py-6">
        <header className="flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden items-center gap-1.5 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              AI front-end builder
            </span>
            <a
              href="#how"
              className="focus-ring rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 transition hover:border-white/20 hover:text-white"
            >
              How it works
            </a>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-12 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:py-16">
          <section className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              5 free generations every day
            </span>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-6xl">
              Describe it.
              <br />
              <span className="text-gradient">Watch it ship.</span>
            </h1>
            <p className="mt-6 max-w-lg text-pretty text-base leading-relaxed text-slate-400">
              Openmi turns a sentence into a working interface. Prompt a landing page, a dashboard or
              a pricing table, watch it render live, then publish a link in one click.
            </p>

            <dl id="how" className="mt-10 grid gap-6 sm:grid-cols-3">
              {FEATURES.map((feature) => (
                <div key={feature.title}>
                  <dt className="text-sm font-medium text-slate-200">{feature.title}</dt>
                  <dd className="mt-1.5 text-xs leading-relaxed text-slate-500">{feature.body}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="animate-fade-up lg:pl-4">
            <div className="relative rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-2xl shadow-black/40 backdrop-blur sm:p-8">
              <div className="pointer-events-none absolute inset-x-10 -top-px h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

              <h2 className="text-lg font-semibold tracking-tight text-white">
                {mode === "demo" ? "Try the builder" : tab === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-1.5 text-sm text-slate-400">
                {mode === "demo"
                  ? "Firebase isn't connected, so this runs in local demo mode."
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
                    className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
                  >
                    {busy ? <LoaderIcon className="h-4 w-4 animate-spin" /> : <ArrowRightIcon className="h-4 w-4" />}
                    Continue in demo mode
                  </button>
                  <p className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-slate-400">
                    Generations stream from a built-in placeholder design and your quota is stored in
                    this browser. Add Firebase keys plus{" "}
                    <code className="rounded bg-white/10 px-1 py-0.5 text-[11px] text-emerald-300">OPENAI_API_KEY</code>{" "}
                    to <code className="text-[11px] text-slate-300">.env.local</code> for real accounts,
                    quota docs and shareable links.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void run("google", signInWithGoogle)}
                    disabled={busy !== null}
                    className="focus-ring mt-6 flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    {busy === "google" ? (
                      <LoaderIcon className="h-4 w-4 animate-spin text-slate-500" />
                    ) : (
                      <GoogleIcon className="h-4 w-4" />
                    )}
                    Continue with Google
                  </button>

                  <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-widest text-slate-600">
                    <span className="h-px flex-1 bg-white/10" />
                    or
                    <span className="h-px flex-1 bg-white/10" />
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-3">
                    <label className="block">
                      <span className="sr-only">Email</span>
                      <span className="relative block">
                        <MailIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(event) => setEmail(event.target.value)}
                          placeholder="you@company.com"
                          className="focus-ring w-full rounded-xl border border-white/10 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
                        />
                      </span>
                    </label>
                    <label className="block">
                      <span className="sr-only">Password</span>
                      <span className="relative block">
                        <LockIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                        <input
                          type="password"
                          required
                          minLength={6}
                          autoComplete={tab === "signin" ? "current-password" : "new-password"}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="At least 6 characters"
                          className="focus-ring w-full rounded-xl border border-white/10 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
                        />
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={busy !== null}
                      className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15 disabled:opacity-60"
                    >
                      {busy === "email" ? <LoaderIcon className="h-4 w-4 animate-spin" /> : null}
                      {tab === "signin" ? "Sign in" : "Create account"}
                    </button>
                  </form>

                  <p className="mt-4 text-center text-xs text-slate-500">
                    {tab === "signin" ? "New to Openmi?" : "Already have an account?"}{" "}
                    <button
                      type="button"
                      onClick={() => setTab(tab === "signin" ? "signup" : "signin")}
                      className="font-medium text-emerald-300 underline-offset-4 hover:underline"
                    >
                      {tab === "signin" ? "Create an account" : "Sign in"}
                    </button>
                  </p>
                </>
              )}
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-start justify-between gap-2 border-t border-white/5 pt-5 text-xs text-slate-600 sm:flex-row sm:items-center">
          <span>Openmi · single-file UIs, generated on demand.</span>
          <span>Preview runs entirely in your browser.</span>
        </footer>
      </div>
    </main>
  );
}
