const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password to continue.",
  "auth/weak-password": "Use at least 6 characters for your password.",
  "auth/email-already-in-use": "An account already exists with that email. Try signing in.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "Email or password is incorrect.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/popup-closed-by-user": "The sign-in popup was closed before finishing.",
  "auth/popup-blocked": "Your browser blocked the sign-in popup. Allow popups and retry.",
  "auth/cancelled-popup-request": "Another sign-in popup is already open.",
  "auth/operation-not-allowed":
    "That sign-in method is disabled. Enable it in Firebase Console → Authentication → Sign-in method.",
  "auth/unauthorized-domain":
    "This domain isn't authorized. Add it in Firebase Console → Authentication → Settings → Authorized domains.",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
  "auth/configuration-not-found":
    "Firebase Authentication isn't set up for this project yet. Enable it in the Firebase Console.",
  "auth/internal-error": "Firebase returned an internal error. Try again in a moment.",
};

/** Turns a Firebase auth error (or anything else) into a friendly sentence. */
export function describeAuthError(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}
