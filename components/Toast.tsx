"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  link?: { label: string; href: string };
};

type ToastRecord = ToastInput & { id: number };

type ToastContextValue = { push: (toast: ToastInput) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, { ring: string; icon: string; dot: string }> = {
  success: { ring: "border-emerald-400/30", icon: "text-emerald-300", dot: "bg-emerald-400" },
  error: { ring: "border-rose-400/30", icon: "text-rose-300", dot: "bg-rose-400" },
  info: { ring: "border-sky-400/30", icon: "text-sky-300", dot: "bg-sky-400" },
};

function ToneIcon({ tone }: { tone: ToastTone }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path d="m4 12 5 5L20 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
        <path d="M12 8v5M12 17h.01" strokeLinecap="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
      <path d="M12 11v5M12 8h.01" strokeLinecap="round" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: ToastInput) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== id));
      }, 7000);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[min(92vw,380px)]"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? "info";
          const styles = TONE_STYLES[tone];
          return (
            <div
              key={toast.id}
              className={`pointer-events-auto w-full animate-fade-up rounded-xl border bg-slate-900/95 p-4 shadow-2xl shadow-black/50 backdrop-blur ${styles.ring}`}
            >
              <div className="flex gap-3">
                <span className={`mt-0.5 ${styles.icon}`}>
                  <ToneIcon tone={tone} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-50">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 break-words text-xs leading-relaxed text-slate-400">
                      {toast.description}
                    </p>
                  ) : null}
                  {toast.link ? (
                    <a
                      href={toast.link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                    >
                      {toast.link.label}
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                        <path d="M7 17 17 7M9 7h8v8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </a>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="-mr-1 -mt-1 rounded-lg p-1 text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
                  aria-label="Dismiss notification"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5">
                    <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <span className={`mt-3 block h-px w-full ${styles.dot} opacity-20`} />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside <ToastProvider>.");
  return context;
}
