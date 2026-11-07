import { DAILY_GENERATION_LIMIT, DEMO_STORAGE_KEYS } from "@/lib/config";

import {
  todayKey,
  type Backend,
  type ConsumeResult,
  type Quota,
  type SessionUser,
} from "./types";

const DEMO_USER: SessionUser = {
  uid: "demo-builder",
  email: "builder@openmi.demo",
  displayName: "Demo Builder",
  photoURL: null,
};

type StoredQuota = { date: string; remaining: number };

function readSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_STORAGE_KEYS.session) === "1";
  } catch {
    return false;
  }
}

function writeSession(signedIn: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (signedIn) window.localStorage.setItem(DEMO_STORAGE_KEYS.session, "1");
    else window.localStorage.removeItem(DEMO_STORAGE_KEYS.session);
  } catch {
    /* storage can be unavailable in private mode - demo stays session-only */
  }
}

function readQuota(): Quota {
  const today = todayKey();
  if (typeof window === "undefined") {
    return { remaining: DAILY_GENERATION_LIMIT, limit: DAILY_GENERATION_LIMIT, date: today };
  }
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEYS.quota);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredQuota;
      if (parsed?.date === today && typeof parsed.remaining === "number") {
        return {
          remaining: Math.max(0, Math.min(DAILY_GENERATION_LIMIT, parsed.remaining)),
          limit: DAILY_GENERATION_LIMIT,
          date: today,
        };
      }
    }
    window.localStorage.setItem(
      DEMO_STORAGE_KEYS.quota,
      JSON.stringify({ date: today, remaining: DAILY_GENERATION_LIMIT } satisfies StoredQuota),
    );
  } catch {
    /* ignore */
  }
  return { remaining: DAILY_GENERATION_LIMIT, limit: DAILY_GENERATION_LIMIT, date: today };
}

function writeQuota(quota: Quota): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DEMO_STORAGE_KEYS.quota,
      JSON.stringify({ date: quota.date, remaining: quota.remaining } satisfies StoredQuota),
    );
  } catch {
    /* ignore */
  }
}

/**
 * Keyless mode: lets the builder, quota counter and live preview be tried
 * without any Firebase project. Nothing leaves the browser.
 */
export const demoBackend: Backend = {
  mode: "demo",

  onChange(listener) {
    // Defer so the initial callback always lands after mount.
    const emit = () => listener(readSession() ? DEMO_USER : null);
    const timer = window.setTimeout(emit, 0);
    const onStorage = (event: StorageEvent) => {
      if (event.key === DEMO_STORAGE_KEYS.session) emit();
    };
    const onLocalChange = () => emit();
    window.addEventListener("storage", onStorage);
    window.addEventListener("openmi:demo-change", onLocalChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("openmi:demo-change", onLocalChange);
    };
  },

  async signInWithGoogle() {
    writeSession(true);
    window.dispatchEvent(new Event("openmi:demo-change"));
  },

  async signInWithEmail() {
    writeSession(true);
    window.dispatchEvent(new Event("openmi:demo-change"));
  },

  async signUpWithEmail() {
    writeSession(true);
    window.dispatchEvent(new Event("openmi:demo-change"));
  },

  async signOutUser() {
    writeSession(false);
    window.dispatchEvent(new Event("openmi:demo-change"));
  },

  async loadQuota() {
    return readQuota();
  },

  async consumeQuota(): Promise<ConsumeResult> {
    const current = readQuota();
    if (current.remaining <= 0) return { allowed: false, quota: current };
    const next: Quota = { ...current, remaining: current.remaining - 1 };
    writeQuota(next);
    return { allowed: true, quota: next };
  },

  async publish() {
    throw new Error(
      "Publishing needs Firebase. Add your Firebase keys to .env.local to create shareable links.",
    );
  },
};
