import { FieldValue } from "firebase-admin/firestore";

import { COLLECTIONS, DAILY_GENERATION_LIMIT } from "@/lib/config";

import { adminDb } from "./admin";

/** UTC day key — quotas roll over at midnight UTC, matching the UI copy. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function clampRemaining(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DAILY_GENERATION_LIMIT;
  return Math.max(0, Math.min(DAILY_GENERATION_LIMIT, Math.floor(value)));
}

/**
 * Cheap pre-flight read so an exhausted account never spends a model call.
 * Read-only: the reset itself happens when a generation is charged.
 */
export async function readRemaining(uid: string): Promise<number> {
  const snapshot = await adminDb().doc(`${COLLECTIONS.users}/${uid}`).get();
  if (!snapshot.exists) return DAILY_GENERATION_LIMIT;

  const data = snapshot.data() ?? {};
  if (data.last_reset_date !== todayUtc()) return DAILY_GENERATION_LIMIT;
  return clampRemaining(data.generations_left);
}

/**
 * Takes one credit, and only ever runs after a generation produced usable
 * output. Returns the remaining count (or 0 when the counter was already
 * empty and there was nothing to take).
 */
export async function chargeGeneration(uid: string, email: string | null): Promise<number> {
  const ref = adminDb().doc(`${COLLECTIONS.users}/${uid}`);
  const today = todayUtc();

  return adminDb().runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.exists ? snapshot.data() ?? {} : null;

    if (!data || data.last_reset_date !== today) {
      const remaining = DAILY_GENERATION_LIMIT - 1;
      transaction.set(
        ref,
        {
          email,
          generations_left: remaining,
          last_reset_date: today,
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return remaining;
    }

    const current = clampRemaining(data.generations_left);
    if (current <= 0) return 0;

    const remaining = current - 1;
    transaction.update(ref, { generations_left: remaining, last_reset_date: today });
    return remaining;
  });
}
