import { DAILY_GENERATION_LIMIT, DEMO_STORAGE_KEYS } from "@/lib/config";

import {
  todayKey,
  type Backend,
  type ChatRecord,
  type ConsumeResult,
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

function readChats(): ChatRecord[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(DEMO_STORAGE_KEYS.chats);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is ChatRecord => {
      const chat = entry as ChatRecord | null;
      return Boolean(chat && typeof chat.id === "string" && Array.isArray(chat.files));
    });
  } catch {
    return [];
  }
}

function writeChats(chats: ChatRecord[]): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(DEMO_STORAGE_KEYS.chats, JSON.stringify(chats.slice(0, 5)));
  } catch {
    /* quota exceeded - the live session still works */
  }
}

/**
 * Keyless mode: lets the chat, multi-file preview, quota counter and history be
 * tried without any Firebase project. Files stay in this browser.
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

  async listChats() {
    return readChats().sort((a, b) => b.updatedAt - a.updatedAt);
  },

  async saveChat(_user, chat) {
    const others = readChats().filter((entry) => entry.id !== chat.id);
    writeChats([chat, ...others]);
  },

  async publish() {
    throw new Error(
      "Publishing needs Firebase. Add your Firebase keys to .env.local to create shareable links.",
    );
  },

  async unpublish() {
    throw new Error(
      "Publishing needs Firebase. Add your Firebase keys to .env.local to manage shareable links.",
    );
  },
};
