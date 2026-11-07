import type { FileBundle } from "@/lib/file-bundle";

import { adminBucket } from "./admin";

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  webmanifest: "application/manifest+json",
};

export function contentTypeFor(path: string): string {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  return MIME[extension] ?? "application/octet-stream";
}

/** Storage prefix for a chat's generated project. */
export function previewPrefix(chatId: string): string {
  return `previews/${chatId}`;
}

/**
 * Writes every file of a generation to Storage, then removes files that no
 * longer exist in the bundle (a page the user asked to delete, a renamed CSS
 * file). Returns true when the write succeeded.
 */
export async function saveBundle(chatId: string, bundle: FileBundle): Promise<boolean> {
  try {
    const bucket = adminBucket();
    const prefix = `${previewPrefix(chatId)}/`;

    await Promise.all(
      bundle.files.map((file) =>
        bucket.file(`${prefix}${file.path}`).save(file.content, {
          contentType: contentTypeFor(file.path),
          resumable: false,
          metadata: { cacheControl: "public, max-age=30" },
        }),
      ),
    );

    const keep = new Set(bundle.files.map((file) => `${prefix}${file.path}`));
    const [existing] = await bucket.getFiles({ prefix });
    await Promise.all(
      existing
        .filter((file) => !keep.has(file.name))
        .map((file) => file.delete().catch(() => undefined)),
    );

    return true;
  } catch (error) {
    console.error("[openmi] could not save the project to storage", error);
    return false;
  }
}

/** Reads one generated file; null when it does not exist. */
export async function readFile(chatId: string, relativePath: string): Promise<Buffer | null> {
  try {
    const [buffer] = await adminBucket()
      .file(`${previewPrefix(chatId)}/${relativePath}`)
      .download();
    return buffer;
  } catch {
    return null;
  }
}
