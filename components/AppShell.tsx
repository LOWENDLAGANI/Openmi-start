"use client";

import { useAuth } from "./AuthProvider";
import { Builder } from "./Builder";
import { Landing } from "./Landing";
import { Logo } from "./Logo";

export function AppShell() {
  const { ready, user } = useAuth();

  if (!ready) {
    return (
      <main className="grid min-h-dvh place-items-center bg-paper">
        <div className="flex flex-col items-center gap-5">
          <Logo href={null} />
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
            <span className="eyebrow">Preparing workspace</span>
          </div>
        </div>
      </main>
    );
  }

  return user ? <Builder /> : <Landing />;
}
