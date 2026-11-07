import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";

export default function HomePage() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
