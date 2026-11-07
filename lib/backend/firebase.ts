import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Firestore,
} from "firebase/firestore";

import { COLLECTIONS, DAILY_GENERATION_LIMIT, firebaseConfig } from "@/lib/config";

import {
  randomProjectId,
  todayKey,
  type Backend,
  type ConsumeResult,
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
  };
}

function quotaFor(remaining: number): Quota {
  return { remaining, limit: DAILY_GENERATION_LIMIT, date: todayKey() };
}

/**
 * Ensures a `users/{uid}` document exists and applies the daily reset.
 * Runs inside a transaction so concurrent tabs cannot double-reset.
 */
async function syncQuota(uid: string, email: string | null): Promise<Quota> {
  const ref = doc(db(), COLLECTIONS.users, uid);
  const today = todayKey();

  return runTransaction(db(), async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) {
      tx.set(ref, {
        email,
        generations_left: DAILY_GENERATION_LIMIT,
        last_reset_date: today,
        created_at: serverTimestamp(),
      });
      return quotaFor(DAILY_GENERATION_LIMIT);
    }

    const data = snapshot.data();
    const storedDate = typeof data.last_reset_date === "string" ? data.last_reset_date : "";
    const storedLeft = typeof data.generations_left === "number" ? data.generations_left : 0;

    if (storedDate !== today) {
      tx.update(ref, { generations_left: DAILY_GENERATION_LIMIT, last_reset_date: today });
      return quotaFor(DAILY_GENERATION_LIMIT);
    }

    const remaining = Math.max(0, Math.min(DAILY_GENERATION_LIMIT, storedLeft));
    return quotaFor(remaining);
  });
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
    await createUserWithEmailAndPassword(auth(), email.trim(), password);
  },

  async signOutUser() {
    await signOut(auth());
  },

  loadQuota(user) {
    return syncQuota(user.uid, user.email);
  },

  async consumeQuota(user): Promise<ConsumeResult> {
    const ref = doc(db(), COLLECTIONS.users, user.uid);
    const today = todayKey();

    return runTransaction(db(), async (tx) => {
      const snapshot = await tx.get(ref);
      const data = snapshot.exists() ? snapshot.data() : null;

      if (!snapshot.exists() || data?.last_reset_date !== today) {
        const next = DAILY_GENERATION_LIMIT - 1;
        tx.set(
          ref,
          {
            email: user.email,
            generations_left: next,
            last_reset_date: today,
            created_at: serverTimestamp(),
          },
          { merge: true },
        );
        return { allowed: true, quota: quotaFor(next) };
      }

      const storedLeft = typeof data?.generations_left === "number" ? data.generations_left : 0;
      if (storedLeft <= 0) {
        return { allowed: false, quota: quotaFor(0) };
      }

      const next = storedLeft - 1;
      tx.update(ref, { generations_left: next, last_reset_date: today });
      return { allowed: true, quota: quotaFor(next) };
    });
  },

  async publish(user, code) {
    const id = randomProjectId(6);
    await setDoc(doc(db(), COLLECTIONS.projects, id), {
      id,
      user_id: user.uid,
      code,
      created_at: serverTimestamp(),
    });
    return { id };
  },
};

/** Re-exported for the published viewer page's REST fallback. */
export async function readProjectFromFirestore(id: string) {
  const ref = doc(db(), COLLECTIONS.projects, id);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) return null;
  const data = snapshot.data();
  return typeof data.code === "string" ? { code: data.code } : null;
}
