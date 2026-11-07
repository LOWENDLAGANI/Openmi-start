export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
};

export type Quota = {
  /** Generations left for `date`. */
  remaining: number;
  /** Daily allowance. */
  limit: number;
  /** UTC day key, e.g. "2026-11-07". */
  date: string;
};

export type ConsumeResult = {
  allowed: boolean;
  quota: Quota;
};

export type PublishResult = {
  id: string;
};

export type BackendMode = "firebase" | "demo";

/**
 * Everything the UI needs from persistence. Two implementations exist:
 * Firestore (real accounts, quota docs, published projects) and an offline
 * localStorage demo used when Firebase keys are missing.
 */
export interface Backend {
  readonly mode: BackendMode;
  /** Subscribe to session changes. Returns an unsubscribe function. */
  onChange(listener: (user: SessionUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  signOutUser(): Promise<void>;
  /** Reads the quota, applying the daily reset if the day changed. */
  loadQuota(user: SessionUser): Promise<Quota>;
  /** Atomically spends one generation, resetting first when the day changed. */
  consumeQuota(user: SessionUser): Promise<ConsumeResult>;
  /** Stores the creation and returns its public id. */
  publish(user: SessionUser, code: string): Promise<PublishResult>;
}

/** UTC day key: quota windows roll over at midnight UTC. */
export function todayKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Cryptographically random, URL-safe id (default 6 characters). */
export function randomProjectId(length = 6): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(length);
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  let id = "";
  for (let i = 0; i < length; i += 1) id += alphabet[bytes[i] % alphabet.length];
  return id;
}
