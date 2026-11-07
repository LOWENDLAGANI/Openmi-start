import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/Logo";
import { firebaseConfig, isFirebaseConfigured } from "@/lib/config";
import { buildPreviewDocument } from "@/lib/preview-html";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

type LoadedProject = {
  /** Storage-backed multi-file project. */
  chatId: string | null;
  entry: string | null;
  /** Legacy single-file HTML projects. */
  code: string | null;
  createdAt: string | null;
};

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
      chat_id?: { stringValue?: string };
      entry?: { stringValue?: string };
      created_at?: { timestampValue?: string };
    };
  };

  const chatId = data.fields?.chat_id?.stringValue ?? null;
  const code = data.fields?.code?.stringValue ?? null;

  if (!chatId && !(typeof code === "string" && code.trim())) return null;

  return {
    chatId,
    entry: data.fields?.entry?.stringValue ?? "index.html",
    code,
    createdAt: data.fields?.created_at?.timestampValue ?? null,
  };
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
    <main className="fixed inset-0 bg-paper">
      <iframe
        title={`Openmi project ${id}`}
        {...(project.chatId
          ? { src: `/api/preview/${project.chatId}/${project.entry ?? "index.html"}` }
          : { srcDoc: buildPreviewDocument(project.code ?? "") })}
        sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-downloads"
        className="h-full w-full border-0 bg-white"
      />
      <Link
        href="/"
        className="fixed bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-full bg-ink px-3.5 py-2 text-[11px] font-medium tracking-[0.02em] text-paper shadow-sm transition-colors hover:bg-brand hover:text-white"
      >
        <span className="grid h-3.5 w-3.5 place-items-center rounded-[3px] bg-brand">
          <span className="h-1 w-1 bg-ink" />
        </span>
        Made with Openmi
      </Link>
    </main>
  );
}

function MessagePage({ title, body }: { title: string; body: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-5 py-16">
      <div className="w-full max-w-lg border border-line bg-paperAlt p-8 sm:p-10">
        <Logo href={null} />
        <span className="eyebrow mt-7 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          Shared link
        </span>
        <h1 className="display mt-4 text-[clamp(1.8rem,4vw,2.6rem)]">{title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-inkSoft">{body}</p>
        <Link href="/" className="btn-primary mt-7 h-11 px-5">
          Build something with Openmi
        </Link>
      </div>
    </main>
  );
}
