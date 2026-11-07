import { sanitizePath } from "@/lib/file-bundle";
import { isAdminConfigured } from "@/lib/server/admin";
import { contentTypeFor, readFile } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves a chat's generated project straight from Storage, which is what makes
 * multi-page output work: index.html links to about.html with a relative href
 * and the browser resolves it under this same prefix.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ chatId: string; path?: string[] }> },
) {
  const { chatId, path } = await context.params;

  if (!/^[a-z0-9]{6,40}$/.test(chatId)) {
    return new Response("Not found", { status: 404 });
  }
  if (!isAdminConfigured()) {
    return new Response("Preview storage is not configured.", { status: 503 });
  }

  const requested = (path ?? []).join("/") || "index.html";
  const relative = requested.endsWith("/") ? `${requested}index.html` : sanitizePath(requested);
  const file = await readFile(chatId, relative);

  if (!file) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": contentTypeFor(relative),
      "Cache-Control": "public, max-age=30",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
