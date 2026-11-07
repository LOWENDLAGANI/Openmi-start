"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getBackend } from "@/lib/backend";
import type { BackendMode, PublishResult, Quota, SessionUser } from "@/lib/backend/types";

type AuthContextValue = {
  ready: boolean;
  user: SessionUser | null;
  quota: Quota | null;
  mode: BackendMode;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  /** Spends one generation. Returns false when the daily limit is hit. */
  consume: () => Promise<boolean>;
  publish: (code: string) => Promise<PublishResult>;
  refreshQuota: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const backend = useMemo(() => getBackend(), []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
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
        setReady(true);
        return;
      }

      try {
        const nextQuota = await backend.loadQuota(nextUser);
        if (active) setQuota(nextQuota);
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

  const publish = useCallback(
    async (code: string) => {
      const current = userRef.current;
      if (!current) throw new Error("Sign in before publishing.");
      return backend.publish(current, code);
    },
    [backend],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      user,
      quota,
      mode: backend.mode,
      signInWithGoogle: () => backend.signInWithGoogle(),
      signInWithEmail: (email, password) => backend.signInWithEmail(email, password),
      signUpWithEmail: (email, password) => backend.signUpWithEmail(email, password),
      signOutUser: () => backend.signOutUser(),
      consume,
      publish,
      refreshQuota,
    }),
    [ready, user, quota, backend.mode, backend, consume, publish, refreshQuota],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
