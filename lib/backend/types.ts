export type SessionUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
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

/** A saved generation, shown in the build history. */
export type GenerationRecord = {
  id: string;
  prompt: string;
  code: string;
  /** Epoch milliseconds. */
  createdAt: number;
  publishedId: string | null;
};

export type BackendMode = "firebase" | "demo";

/**
 * Everything the UI needs from persistence. Two implementations exist:
 * Firestore (real accounts, server-charged quota, published projects) and an
 * offline localStorage demo used when Firebase keys are missing.
 */
export interface Backend {
  readonly mode: BackendMode;
  /** Subscribe to session changes. Returns an unsubscribe function. */
  onChange(listener: (user: SessionUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signInWithEmail(email: string, password: string): Promise<void>;
  signUpWithEmail(email: string, password: string): Promise<void>;
  signOutUser(): Promise<void>;
  /** Sends a Firebase password-reset email. */
  sendPasswordReset(email: string): Promise<void>;
  /** Re-sends the email verification link for the signed-in account. */
  resendVerificationEmail(): Promise<void>;
  /** Re-reads the account so a freshly verified email is reflected. */
  refreshUser(): Promise<SessionUser | null>;
  /** Bearer token for /api/generate; null when there is no server identity. */
  getIdToken(): Promise<string | null>;
  /** Reads the quota. Server-side documents are created on first charge. */
  loadQuota(user: SessionUser): Promise<Quota>;
  /**
   * Demo only: decrements the browser-local counter after a successful run.
   * With Firebase, credits are charged by the server once generation succeeds.
   */
  consumeQuota(user: SessionUser): Promise<ConsumeResult>;
  listGenerations(user: SessionUser): Promise<GenerationRecord[]>;
  saveGeneration(
    user: SessionUser,
    input: { prompt: string; code: string },
  ): Promise<GenerationRecord>;
  /** Stores the creation and returns its public id. */
  publish(
    user: SessionUser,
    input: { code: string; generationId?: string | null },
  ): Promise<PublishResult>;
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
