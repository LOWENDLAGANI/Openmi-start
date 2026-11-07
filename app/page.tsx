import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { aiStatus } from "@/lib/ai-config";
import { isAdminConfigured } from "@/lib/server/admin";

// The AI provider and the quota backend are resolved per request, so a
// deployment's env decides the badge, the generator and the charging path
// without a rebuild.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const ai = aiStatus();
  const quotaServer = isAdminConfigured();

  return (
    <AuthProvider>
      <AppShell ai={ai} quotaServer={quotaServer} />
    </AuthProvider>
  );
}
