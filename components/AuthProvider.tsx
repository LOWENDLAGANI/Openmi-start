"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getBackend } from "@/lib/backend";
import type {
  BackendMode,
  GenerationRecord,
  PublishResult,
  Quota,
  SessionUser,
} from "@/lib/backend/types";

type AuthContextValue = {
  ready: boolean;
  user: SessionUser | null;
  quota: Quota | null;
  history: GenerationRecord[];
  mode: BackendMode;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  /** Re-reads the account so a freshly verified email shows up. */
  refreshUser: () => Promise<SessionUser | null>;
  /** Bearer token for /api/generate (null in demo mode). */
  getIdToken: () => Promise<string | null>;
  /** Demo only: spends one browser-local credit after a successful run. */
  consume: () => Promise<boolean>;
  publish: (input: { code: string; generationId?: string | null }) => Promise<PublishResult>;
  saveGeneration: (input: { prompt: string; code: string }) => Promise<GenerationRecord>;
  refreshQuota: () => Promise<void>;
  refreshHistory: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const backend = useMemo(() => getBackend(), []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [ready, setReady] = useState(false);
  const userRef = useRef<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    const unsubscribe = backend.onChange(async (nextUser) => {
      if (!active) return;
      userRef.current = nextUser;
      setUser(nextUser);

      if (!nextUser) {
        setQuota(null);
        setHistory([]);
        setReady(true);
        return;
      }

      try {
        const [nextQuota, nextHistory] = await Promise.all([
          backend.loadQuota(nextUser),
          backend.listGenerations(nextUser).catch((error: unknown) => {
            // History is a convenience: a rules/index problem must not block the builder.
            console.error("[openmi] failed to load build history", error);
            return [] as GenerationRecord[];
          }),
        ]);
        if (active) {
          setQuota(nextQuota);
          setHistory(nextHistory);
        }
      } catch (error) {
        console.error("[openmi] failed to load quota", error);
      } finally {
        if (active) setReady(true);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [backend]);

  const refreshQuota = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    try {
      setQuota(await backend.loadQuota(current));
    } catch (error) {
      console.error("[openmi] failed to refresh quota", error);
    }
  }, [backend]);

  const refreshHistory = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    try {
      setHistory(await backend.listGenerations(current));
    } catch (error) {
      console.error("[openmi] failed to refresh build history", error);
    }
  }, [backend]);

  const consume = useCallback(async () => {
    const current = userRef.current;
    if (!current) return false;
    try {
      const result = await backend.consumeQuota(current);
      setQuota(result.quota);
      return result.allowed;
    } catch (error) {
      console.error("[openmi] failed to spend a generation", error);
      throw error;
    }
  }, [backend]);

  const saveGeneration = useCallback(
    async (input: { prompt: string; code: string }) => {
      const current = userRef.current;
      if (!current) throw new Error("Sign in before saving a build.");
      const record = await backend.saveGeneration(current, input);
      setHistory((previous) => [record, ...previous].slice(0, 20));
      return record;
    },
    [backend],
  );

  const publish = useCallback(
    async (input: { code: string; generationId?: string | null }) => {
      const current = userRef.current;
      if (!current) throw new Error("Sign in before publishing.");
      return backend.publish(current, input);
    },
    [backend],
  );

  const refreshUser = useCallback(async () => {
    try {
      const next = await backend.refreshUser();
      if (next) setUser(next);
      return next;
    } catch (error) {
      console.error("[openmi] failed to refresh the account", error);
      return null;
    }
  }, [backend]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      quota,
      history,
      mode: backend.mode,
      signInWithGoogle: () => backend.signInWithGoogle(),
      signInWithEmail: (email, password) => backend.signInWithEmail(email, password),
      signUpWithEmail: (email, password) => backend.signUpWithEmail(email, password),
      signOutUser: () => backend.signOutUser(),
      sendPasswordReset: (email) => backend.sendPasswordReset(email),
      resendVerificationEmail: () => backend.resendVerificationEmail(),
      refreshUser,
      getIdToken: () => backend.getIdToken(),
      consume,
      publish,
      saveGeneration,
      refreshQuota,
      refreshHistory,
    }),
    [ready, user, quota, history, backend, consume, publish, saveGeneration, refreshQuota, refreshHistory, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
