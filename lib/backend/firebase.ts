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
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";

import { COLLECTIONS, DAILY_GENERATION_LIMIT, firebaseConfig } from "@/lib/config";

import {
  randomProjectId,
  todayKey,
  type Backend,
  type GenerationRecord,
  type PublishResult,
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

function toGenerationRecord(id: string, data: Record<string, unknown>): GenerationRecord {
  const stamp = data.created_at as { toMillis?: () => number } | null | undefined;
  const createdAt = typeof stamp?.toMillis === "function" ? stamp.toMillis() : Date.now();
  return {
    id,
    prompt: typeof data.prompt === "string" ? data.prompt : "",
    code: typeof data.code === "string" ? data.code : "",
    createdAt,
    publishedId: typeof data.published_id === "string" ? data.published_id : null,
  };
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

  async listGenerations(user) {
    // Single-field equality keeps this index-free; ordering happens client-side.
    const snapshot = await getDocs(
      query(
        collection(db(), COLLECTIONS.generations),
        where("user_id", "==", user.uid),
        limitQuery(40),
      ),
    );
    return snapshot.docs
      .map((entry) => toGenerationRecord(entry.id, entry.data()))
      .filter((record) => record.code.length > 0)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 20);
  },

  async saveGeneration(user, { prompt, code }) {
    const id = randomProjectId(20);
    await setDoc(doc(db(), COLLECTIONS.generations, id), {
      id,
      user_id: user.uid,
      prompt,
      code,
      published_id: null,
      created_at: serverTimestamp(),
    });
    return { id, prompt, code, createdAt: Date.now(), publishedId: null };
  },

  async publish(user, { code, generationId }): Promise<PublishResult> {
    const id = randomProjectId(6);
    await setDoc(doc(db(), COLLECTIONS.projects, id), {
      id,
      user_id: user.uid,
      code,
      created_at: serverTimestamp(),
    });

    if (generationId) {
      await updateDoc(doc(db(), COLLECTIONS.generations, generationId), {
        published_id: id,
        published_at: serverTimestamp(),
      }).catch((error: unknown) => {
        // The public link exists either way; history just stays unlabelled.
        console.error("[openmi] could not mark the generation as published", error);
      });
    }

    return { id };
  },
};
