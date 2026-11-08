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

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  /** Epoch milliseconds. */
  at: number;
};

export type ChatFile = { path: string; content: string };

/**
 * One build conversation. Files live in Firebase Storage (served by
 * `/api/preview/<id>/`) and a copy rides along here so a chat can be reopened
 * and continued without another round-trip.
 */
export type ChatRecord = {
  id: string;
  title: string;
  entry: string;
  files: ChatFile[];
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  publishedId: string | null;
};

export type BackendMode = "firebase" | "demo";

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
  /** Bearer token for the server routes; null when there is no server identity. */
  getIdToken(): Promise<string | null>;
  /** Reads the quota. Server-side documents are created on first charge. */
  loadQuota(user: SessionUser): Promise<Quota>;
  /**
   * Demo only: decrements the browser-local counter after a successful run.
   * With Firebase, credits are charged by the server once generation succeeds.
   */
  consumeQuota(user: SessionUser): Promise<ConsumeResult>;
  listChats(user: SessionUser): Promise<ChatRecord[]>;
  saveChat(user: SessionUser, chat: ChatRecord): Promise<void>;
  /**
   * Publishes a chat's project and returns its public id. Pass `projectId` to
   * republish onto an existing link instead of creating a new one.
   */
  publish(
    user: SessionUser,
    input: { chatId: string; entry: string; projectId?: string },
  ): Promise<PublishResult>;
  /** Removes a published link for good. Only its owner can. */
  unpublish(user: SessionUser, projectId: string): Promise<void>;
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

export function chatTitle(prompt: string): string {
  const clean = prompt.trim().replace(/\s+/g, " ");
  if (!clean) return "Untitled build";
  return clean.length > 58 ? `${clean.slice(0, 58).trim()}…` : clean;
}
