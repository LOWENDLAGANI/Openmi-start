/**
 * Multi-file generation format.
 *
 * The model emits a sequence of blocks:
 *
 *   <<<FILE path="index.html">>>
 *   ...file contents...
 *   <<<END FILE>>>
 *
 * This module parses that stream (tolerating the unterminated block that exists
 * while tokens are still arriving) and inlines a bundle into one document for
 * the zero-server live preview.
 */

import { cleanGeneratedHtml } from "./preview-html";

export type BundledFile = { path: string; content: string };
export type FileBundle = { entry: string; files: BundledFile[] };

const MAX_FILES = 12;
const START = /^<<<FILE\s+path="([^"]+)"\s*>>>$/i;
const END = /^<<<END(\s+FILE)?>>>$/i;

/** Strips traversal, absolute prefixes and stray whitespace from model paths. */
export function sanitizePath(path: string): string {
  const cleaned = path
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
  return cleaned.replace(/[^a-zA-Z0-9._/-]/g, "-").slice(0, 120) || "index.html";
}

/**
 * Parses a (possibly partial) stream into files. The last block is kept even
 * without its closing marker so the preview can render while tokens arrive.
 */
export function parseFileBundle(raw: string): FileBundle {
  const text = raw.replace(/\r\n/g, "\n");
  const files: BundledFile[] = [];
  let currentPath: string | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentPath) return;
    const content = buffer.join("\n").trim();
    if (content) {
      const path = sanitizePath(currentPath);
      if (!files.some((file) => file.path === path)) files.push({ path, content });
    }
    buffer = [];
  };

  for (const line of text.split("\n")) {
    const start = line.trim().match(START);
    if (start) {
      flush();
      currentPath = start[1];
      continue;
    }
    if (END.test(line.trim())) {
      flush();
      currentPath = null;
      continue;
    }
    if (currentPath) buffer.push(line);
  }
  flush();

  // The model ignored the format: treat the whole answer as one page, but only
  // if it actually looks like markup. A plain prose reply is a chat message —
  // a clarifying question, say — not a one-file site.
  if (files.length === 0) {
    const html = cleanGeneratedHtml(raw);
    const looksLikeMarkup =
      /<(html|body|main|div|section|header|nav|aside|footer|style|script|h1|h2|p|a|button|form|svg|table|ul)\b/i.test(
        html,
      );
    if (html && looksLikeMarkup) files.push({ path: "index.html", content: html });
  }

  const entry =
    files.find((file) => /(^|\/)index\.html$/.test(file.path))?.path ??
    files[0]?.path ??
    "index.html";

  return { entry, files: files.slice(0, MAX_FILES) };
}

/** The file currently being written, for the streaming indicator. */
export function activeFilePath(raw: string): string | null {
  const matches = [...raw.matchAll(/<<<FILE\s+path="([^"]+)"\s*>>>/gi)];
  if (!matches.length) return null;
  const closed = /<<<END(\s+FILE)?>>>\s*$/i.test(raw.trim());
  if (closed) return null;
  return sanitizePath(matches[matches.length - 1][1]);
}

export function bundleSize(files: BundledFile[]): number {
  return files.reduce((total, file) => total + new TextEncoder().encode(file.content).length, 0);
}

export function bundleToMap(files: BundledFile[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const file of files) map[file.path] = file.content;
  return map;
}
