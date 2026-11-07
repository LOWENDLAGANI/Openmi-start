import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";
import { aiStatus } from "@/lib/ai-config";

// The AI provider is resolved per request so a deployment's env decides the
// badge and the generator without a rebuild.
export const dynamic = "force-dynamic";

export default function HomePage() {
  const ai = aiStatus();

  return (
    <AuthProvider>
      <AppShell ai={ai} />
    </AuthProvider>
  );
}
