"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { getBackend } from "@/lib/backend";
import type {
  BackendMode,
  ChatRecord,
  PublishResult,
  Quota,
  SessionUser,
} from "@/lib/backend/types";

type AuthContextValue = {
  ready: boolean;
  user: SessionUser | null;
  quota: Quota | null;
  chats: ChatRecord[];
  mode: BackendMode;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  /** Re-reads the account so a freshly verified email shows up. */
  refreshUser: () => Promise<SessionUser | null>;
  /** Bearer token for the server routes (null in demo mode). */
  getIdToken: () => Promise<string | null>;
  /** Demo only: spends one browser-local credit after a successful run. */
  consume: () => Promise<boolean>;
  publish: (input: { chatId: string; entry: string }) => Promise<PublishResult>;
  saveChat: (chat: ChatRecord) => Promise<void>;
  refreshQuota: () => Promise<void>;
  refreshChats: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const backend = useMemo(() => getBackend(), []);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [chats, setChats] = useState<ChatRecord[]>([]);
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
        setChats([]);
        setReady(true);
        return;
      }

      try {
        const [nextQuota, nextChats] = await Promise.all([
          backend.loadQuota(nextUser),
          backend.listChats(nextUser).catch((error: unknown) => {
            // History is a convenience: a rules problem must not block the builder.
            console.error("[openmi] failed to load chats", error);
            return [] as ChatRecord[];
          }),
        ]);
        if (active) {
          setQuota(nextQuota);
          setChats(nextChats);
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

  const refreshChats = useCallback(async () => {
    const current = userRef.current;
    if (!current) return;
    try {
      setChats(await backend.listChats(current));
    } catch (error) {
      console.error("[openmi] failed to refresh chats", error);
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

  const saveChat = useCallback(
    async (chat: ChatRecord) => {
      const current = userRef.current;
      if (!current) throw new Error("Sign in before saving a build.");
      await backend.saveChat(current, chat);
      setChats((previous) => {
        const others = previous.filter((entry) => entry.id !== chat.id);
        return [chat, ...others]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, 20);
      });
    },
    [backend],
  );

  const publish = useCallback(
    async (input: { chatId: string; entry: string }) => {
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
      chats,
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
      saveChat,
      refreshQuota,
      refreshChats,
    }),
    [ready, user, quota, chats, backend, consume, publish, saveChat, refreshQuota, refreshChats, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
