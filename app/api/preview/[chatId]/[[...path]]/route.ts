import { sanitizePath } from "@/lib/file-bundle";
import { isAdminConfigured } from "@/lib/server/admin";
import { contentTypeFor, readFile } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Re-points root-absolute asset URLs at this chat's preview prefix.
 *
 * A page served from `/api/preview/<id>/` resolves `styles.css` correctly, but
 * `/styles.css` escapes to the site root and 404s — which is what an unstyled
 * preview looks like. Generated pages are served from this prefix, so `/x`
 * always means "x in this project". Protocol-relative and external URLs are
 * left alone.
 */
function rewriteAbsoluteRefs(document: string, chatId: string): string {
  const prefix = `/api/preview/${chatId}/`;
  return document.replace(
    /(\b(?:href|src|poster|action)\s*=\s*)(["'])\/(?!\/)([^"']*)\2/gi,
    (_match, attribute: string, quote: string, rest: string) =>
      `${attribute}${quote}${prefix}${rest}${quote}`,
  );
}

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

  const contentType = contentTypeFor(relative);
  const body = contentType.startsWith("text/html")
    ? rewriteAbsoluteRefs(file.toString("utf8"), chatId)
    : new Uint8Array(file);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=30",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
