import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/config";
import { buildPreviewDocument } from "@/lib/preview-html";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type LoadedProject = { code: string; createdAt: string | null };

const PROJECT_ID_PATTERN = /^[a-z0-9]{3,40}$/;

/**
 * Public links are rendered on the server by reading the project document over
 * the Firestore REST API with the public web API key. No admin credentials and
 * no client-side flicker are involved.
 */
async function loadProject(id: string): Promise<LoadedProject | null> {
  const { projectId, apiKey } = firebaseConfig;
  const url =
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}` +
    `/databases/(default)/documents/projects/${encodeURIComponent(id)}?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, { cache: "no-store" });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Firestore responded with ${response.status}.`);
  }

  const data = (await response.json()) as {
    fields?: {
      code?: { stringValue?: string };
      created_at?: { timestampValue?: string };
    };
  };

  const code = data.fields?.code?.stringValue;
  if (typeof code !== "string" || !code.trim()) return null;

  return { code, createdAt: data.fields?.created_at?.timestampValue ?? null };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Openmi · ${id}`,
    description: "An interface generated with Openmi — the AI front-end builder.",
  };
}

export default async function PublishedProjectPage({ params }: PageProps) {
  const { id } = await params;

  if (!PROJECT_ID_PATTERN.test(id)) {
    return <MessagePage title="That link isn't valid" body="Project ids are short lowercase strings." />;
  }

  if (!isFirebaseConfigured) {
    return (
      <MessagePage
        title="Publishing isn't configured"
        body="This deployment has no Firebase project attached, so shared links can't be resolved. Add your NEXT_PUBLIC_FIREBASE_* keys and redeploy."
      />
    );
  }

  let project: LoadedProject | null = null;
  let failed = false;

  try {
    project = await loadProject(id);
  } catch (error) {
    console.error("[openmi] failed to load shared project", error);
    failed = true;
  }

  if (failed) {
    return (
      <MessagePage
        title="We couldn't load this project"
        body="Firestore didn't answer as expected. Refresh in a moment, or open the link again from the original tab."
      />
    );
  }

  if (!project) {
    return (
      <MessagePage
        title="Nothing here yet"
        body="This link doesn't point at a published project. It may have been mistyped, or the design was never published."
      />
    );
  }

  return (
    <main className="fixed inset-0 bg-slate-950">
      <iframe
        title={`Openmi project ${id}`}
        srcDoc={buildPreviewDocument(project.code)}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
        className="h-full w-full border-0 bg-white"
      />
      <Link
        href="/"
        className="fixed bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/85 px-3.5 py-2 text-xs font-medium text-slate-300 shadow-lg shadow-black/40 backdrop-blur transition hover:border-emerald-400/40 hover:text-white"
      >
        <span className="grid h-4 w-4 place-items-center rounded-full bg-gradient-to-br from-emerald-300 to-teal-500 text-[9px] font-bold text-emerald-950">
          o
        </span>
        Made with Openmi
      </Link>
    </main>
  );
}

function MessagePage({ title, body }: { title: string; body: string }) {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-slate-950 px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/60 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur">
        <div className="flex justify-center">
          <Logo href={null} />
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-white">{title}</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-400">{body}</p>
        <Link
          href="/"
          className="focus-ring mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
        >
          Build something with Openmi
        </Link>
      </div>
    </main>
  );
}
