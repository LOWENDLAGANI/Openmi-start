import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin credentials. The admin SDK bypasses Firestore rules, which is
 * what makes quotas server-authoritative: clients can read their own counter
 * but never write it.
 *
 * Two accepted shapes:
 *   1. FIREBASE_SERVICE_ACCOUNT_KEY — the whole JSON key, raw or base64.
 *   2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.
 */
type AdminCredentials = { projectId: string; clientEmail: string; privateKey: string };

function readCredentials(): AdminCredentials | null {
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
  if (encoded) {
    try {
      const json = encoded.startsWith("{") ? encoded : Buffer.from(encoded, "base64").toString("utf8");
      const parsed = JSON.parse(json) as {
        project_id?: string;
        client_email?: string;
        private_key?: string;
      };
      if (parsed.project_id && parsed.client_email && parsed.private_key) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: parsed.private_key,
        };
      }
    } catch (error) {
      console.error("[openmi] FIREBASE_SERVICE_ACCOUNT_KEY is not valid JSON", error);
      return null;
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  // Hosting dashboards often store the key with literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function isAdminConfigured(): boolean {
  return readCredentials() !== null;
}

let cached: App | null = null;

function adminApp(): App {
  if (cached) return cached;
  const credentials = readCredentials();
  if (!credentials) {
    throw new Error(
      "Firebase admin credentials are missing. Set FIREBASE_SERVICE_ACCOUNT_KEY, or FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY.",
    );
  }
  cached = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert({
          projectId: credentials.projectId,
          clientEmail: credentials.clientEmail,
          privateKey: credentials.privateKey,
        }),
        projectId: credentials.projectId,
      });
  return cached;
}

export function adminAuth(): Auth {
  return getAuth(adminApp());
}

export function adminDb(): Firestore {
  return getFirestore(adminApp());
}
