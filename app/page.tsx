import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { isAdminConfigured } from "@/lib/server/admin";

// The quota backend is resolved per request, so a deployment's env decides the
// charging path and the preview source without a rebuild.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const quotaServer = isAdminConfigured();

  return (
    <AuthProvider>
      <AppShell quotaServer={quotaServer} />
    </AuthProvider>
  );
}
