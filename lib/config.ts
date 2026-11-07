/**
 * Runtime configuration shared by the client and the server.
 * All Firebase values are public identifiers, safe to inline in the browser.
 */
export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};

/** Firebase needs at least these three values to boot. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
);

/** Free generations per user per UTC day. */
export const DAILY_GENERATION_LIMIT = 5;

/** Firestore collection names. */
export const COLLECTIONS = {
  users: "users",
  projects: "projects",
} as const;

/** KV store keys used by the keyless demo backend. */
export const DEMO_STORAGE_KEYS = {
  session: "openmi:demo:session",
  quota: "openmi:demo:quota",
} as const;
