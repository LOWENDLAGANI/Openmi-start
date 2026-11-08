import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit as limitQuery,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import { COLLECTIONS, DAILY_GENERATION_LIMIT, firebaseConfig } from "@/lib/config";

import {
  randomProjectId,
  todayKey,
  type Backend,
  type ChatFile,
  type ChatMessage,
  type ChatRecord,
  type Quota,
  type SessionUser,
} from "./types";

let appRef: FirebaseApp | null = null;
let authRef: Auth | null = null;
let dbRef: Firestore | null = null;

function app(): FirebaseApp {
  if (!appRef) {
    appRef = getApps().length ? getApp() : initializeApp(firebaseConfig as FirebaseOptions);
  }
  return appRef;
}

function auth(): Auth {
  if (!authRef) authRef = getAuth(app());
  return authRef;
}

function db(): Firestore {
  if (!dbRef) dbRef = getFirestore(app());
  return dbRef;
}

function toSessionUser(user: User): SessionUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
  };
}

function quotaFor(remaining: number): Quota {
  return { remaining, limit: DAILY_GENERATION_LIMIT, date: todayKey() };
}

/**
 * Read-only quota lookup. The `users/{uid}` document is created and written by
 * the server (Admin SDK) when a generation is charged; Firestore rules deny
 * client writes so the counter cannot be edited from the browser.
 */
async function readQuota(uid: string): Promise<Quota> {
  const snapshot = await getDoc(doc(db(), COLLECTIONS.users, uid));
  if (!snapshot.exists) return quotaFor(DAILY_GENERATION_LIMIT);

  const data = snapshot.data() ?? {};
  if (data.last_reset_date !== todayKey()) return quotaFor(DAILY_GENERATION_LIMIT);

  const stored = typeof data.generations_left === "number" ? data.generations_left : 0;
  return quotaFor(Math.max(0, Math.min(DAILY_GENERATION_LIMIT, stored)));
}

function toChatRecord(id: string, data: Record<string, unknown>): ChatRecord {
  const rawFiles = Array.isArray(data.files) ? data.files : [];
  const files: ChatFile[] = rawFiles
    .map((entry) => {
      const file = entry as { path?: unknown; content?: unknown };
      return {
        path: typeof file.path === "string" ? file.path : "",
        content: typeof file.content === "string" ? file.content : "",
      };
    })
    .filter((file) => file.path && file.content);

  const rawMessages = Array.isArray(data.messages) ? data.messages : [];
  const messages: ChatMessage[] = rawMessages
    .map((entry) => {
      const message = entry as { role?: unknown; content?: unknown; at?: unknown };
      return {
        role: message.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: typeof message.content === "string" ? message.content : "",
        at: typeof message.at === "number" ? message.at : Date.now(),
      };
    })
    .filter((message) => message.content);

  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled build",
    entry: typeof data.entry === "string" ? data.entry : "index.html",
    files,
    messages,
    createdAt: typeof data.created_at === "number" ? data.created_at : Date.now(),
    updatedAt: typeof data.updated_at === "number" ? data.updated_at : Date.now(),
    publishedId: typeof data.published_id === "string" ? data.published_id : null,
  };
}

/**
 * Firestore answers every rules denial with "Missing or insufficient
 * permissions", which reads like an account problem when it is a deployment
 * one: the published ruleset does not allow this write.
 */
const RULES_HINT =
  "Firestore rejected this write. Deploy the security rules (firebase deploy --only firestore:rules) — the published ruleset must let you write your own chats and projects.";

function withRulesHint(error: unknown): Error {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const denied =
    code === "permission-denied" ||
    (error instanceof Error && /insufficient permissions/i.test(error.message));
  if (denied) return new Error(RULES_HINT);
  return error instanceof Error ? error : new Error("Firestore request failed.");
}

export const firebaseBackend: Backend = {
  mode: "firebase",

  onChange(listener) {
    return onAuthStateChanged(auth(), (user) => listener(user ? toSessionUser(user) : null));
  },

  async signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth(), provider);
  },

  async signInWithEmail(email, password) {
    await signInWithEmailAndPassword(auth(), email.trim(), password);
  },

  async signUpWithEmail(email, password) {
    const credential = await createUserWithEmailAndPassword(auth(), email.trim(), password);
    // A failed verification mail must not undo a successful sign-up.
    await sendEmailVerification(credential.user).catch((error: unknown) => {
      console.error("[openmi] could not send the verification email", error);
    });
  },

  async signOutUser() {
    await signOut(auth());
  },

  async sendPasswordReset(email) {
    await sendPasswordResetEmail(auth(), email.trim());
  },

  async resendVerificationEmail() {
    const current = auth().currentUser;
    if (!current) throw new Error("Sign in again to verify your email.");
    if (current.emailVerified) return;
    await sendEmailVerification(current);
  },

  async refreshUser() {
    const current = auth().currentUser;
    if (!current) return null;
    await reload(current);
    return toSessionUser(current);
  },

  async getIdToken() {
    const current = auth().currentUser;
    if (!current) return null;
    return current.getIdToken();
  },

  loadQuota(user) {
    return readQuota(user.uid);
  },

  async consumeQuota(): Promise<never> {
    throw new Error(
      "Quota is charged by the server after a successful generation; the browser cannot spend credits.",
    );
  },

  async listChats(user) {
    // Single-field equality keeps this index-free; ordering happens client-side.
    const snapshot = await getDocs(
      query(
        collection(db(), COLLECTIONS.chats),
        where("user_id", "==", user.uid),
        limitQuery(30),
      ),
    );
    return snapshot.docs
      .map((entry) => toChatRecord(entry.id, entry.data()))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20);
  },

  async saveChat(user, chat) {
    await setDoc(doc(db(), COLLECTIONS.chats, chat.id), {
      id: chat.id,
      user_id: user.uid,
      title: chat.title,
      entry: chat.entry,
      files: chat.files,
      messages: chat.messages.slice(-30),
      published_id: chat.publishedId,
      created_at: chat.createdAt,
      updated_at: chat.updatedAt,
      updated_at_server: serverTimestamp(),
    }).catch((error: unknown) => {
      throw withRulesHint(error);
    });
  },

  async publish(user, { chatId, entry }) {
    const id = randomProjectId(6);
    await setDoc(doc(db(), COLLECTIONS.projects, id), {
      id,
      user_id: user.uid,
      chat_id: chatId,
      entry,
      created_at: serverTimestamp(),
    }).catch((error: unknown) => {
      throw withRulesHint(error);
    });
    return { id };
  },
};
