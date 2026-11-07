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

const TONE: Record<ToastTone, { bar: string; label: string; labelColor: string }> = {
  success: { bar: "bg-ink", label: "Done", labelColor: "text-inkSoft" },
  error: { bar: "bg-brand", label: "Error", labelColor: "text-brand" },
  info: { bar: "bg-line", label: "Note", labelColor: "text-inkSoft" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((current) => [...current.slice(-2), { ...toast, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, 7000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:w-[min(92vw,380px)]"
      >
        {toasts.map((toast) => {
          const tone = toast.tone ?? "info";
          const styles = TONE[tone];
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex w-full animate-fade-up overflow-hidden border border-line bg-white"
            >
              <span className={`w-1 shrink-0 ${styles.bar}`} />
              <div className="min-w-0 flex-1 px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`font-mono text-[9px] uppercase tracking-[0.18em] ${styles.labelColor}`}>
                      {styles.label}
                    </p>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-ink">{toast.title}</p>
                    {toast.description ? (
                      <p className="mt-1 break-words text-xs leading-relaxed text-inkSoft">
                        {toast.description}
                      </p>
                    ) : null}
                    {toast.link ? (
                      <a
                        href={toast.link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2.5 inline-flex items-center gap-1 border-b border-brand font-mono text-[10px] uppercase tracking-[0.12em] text-brand"
                      >
                        {toast.link.label}
                      </a>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(toast.id)}
                    className="-mr-1 -mt-0.5 rounded p-1 text-inkSoft transition hover:text-ink"
                    aria-label="Dismiss notification"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5">
                      <path d="m6 6 12 12M18 6 6 18" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </div>
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
