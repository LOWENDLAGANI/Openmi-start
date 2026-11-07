import { DAILY_GENERATION_LIMIT, DEMO_STORAGE_KEYS } from "@/lib/config";

import {
  randomProjectId,
  todayKey,
  type Backend,
  type ConsumeResult,
  type GenerationRecord,
  type Quota,
  type SessionUser,
} from "./types";

const DEMO_USER: SessionUser = {
  uid: "demo-builder",
  email: "builder@openmi.demo",
  displayName: "Demo Builder",
  photoURL: null,
  // Nothing to verify without an account system.
  emailVerified: true,
};

type StoredQuota = { date: string; remaining: number };

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSession(): boolean {
  return storage()?.getItem(DEMO_STORAGE_KEYS.session) === "1";
}

function writeSession(signedIn: boolean): void {
  const store = storage();
  if (!store) return;
  try {
    if (signedIn) store.setItem(DEMO_STORAGE_KEYS.session, "1");
    else store.removeItem(DEMO_STORAGE_KEYS.session);
  } catch {
    /* storage can be unavailable in private mode - demo stays session-only */
  }
}

function readQuota(): Quota {
  const today = todayKey();
  const store = storage();
  if (!store) {
    return { remaining: DAILY_GENERATION_LIMIT, limit: DAILY_GENERATION_LIMIT, date: today };
  }
  try {
    const raw = store.getItem(DEMO_STORAGE_KEYS.quota);
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
    store.setItem(
      DEMO_STORAGE_KEYS.quota,
      JSON.stringify({ date: today, remaining: DAILY_GENERATION_LIMIT } satisfies StoredQuota),
    );
  } catch {
    /* ignore */
  }
  return { remaining: DAILY_GENERATION_LIMIT, limit: DAILY_GENERATION_LIMIT, date: today };
}

function writeQuota(quota: Quota): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(
      DEMO_STORAGE_KEYS.quota,
      JSON.stringify({ date: quota.date, remaining: quota.remaining } satisfies StoredQuota),
    );
  } catch {
    /* ignore */
  }
}

function readHistory(): GenerationRecord[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(DEMO_STORAGE_KEYS.history);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is GenerationRecord => {
        const record = entry as GenerationRecord | null;
        return Boolean(record && typeof record.id === "string" && typeof record.code === "string");
      })
      .slice(0, 20);
  } catch {
    return [];
  }
}

function writeHistory(records: GenerationRecord[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DEMO_STORAGE_KEYS.history, JSON.stringify(records.slice(0, 20)));
  } catch {
    /* ignore */
  }
}

/**
 * Keyless mode: lets the builder, quota counter, live preview and build history
 * be tried without any Firebase project. Nothing leaves the browser.
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

  async sendPasswordReset() {
    throw new Error("Password resets need Firebase. Add your Firebase keys to .env.local.");
  },

  async resendVerificationEmail() {
    throw new Error("Email verification needs Firebase. Add your Firebase keys to .env.local.");
  },

  async refreshUser() {
    return readSession() ? DEMO_USER : null;
  },

  async getIdToken() {
    return null;
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

  async listGenerations() {
    return readHistory();
  },

  async saveGeneration(_user, { prompt, code }) {
    const record: GenerationRecord = {
      id: randomProjectId(12),
      prompt,
      code,
      createdAt: Date.now(),
      publishedId: null,
    };
    writeHistory([record, ...readHistory()]);
    return record;
  },

  async publish() {
    throw new Error(
      "Publishing needs Firebase. Add your Firebase keys to .env.local to create shareable links.",
    );
  },
};
