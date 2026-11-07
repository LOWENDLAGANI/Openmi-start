/**
 * Preview helpers. Generated designs are deliberately NOT styled like Openmi:
 * this file injects only the runtime a static site needs (Tailwind if the model
 * used it, Lucide if it used icon placeholders) and a minimal reset.
 */

import type { FileBundle } from "./file-bundle";

const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const LUCIDE_CDN = "https://unpkg.com/lucide@latest/dist/umd/lucide.min.js";

const BASE_STYLE = `<style>
    html { background: #ffffff; }
    body { margin: 0; }
    img, video, svg { max-width: 100%; }
  </style>`;

const LUCIDE_BOOT = `<script>
  (function () {
    function paint() { try { window.lucide && window.lucide.createIcons(); } catch (e) {} }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", paint);
    else paint();
    setTimeout(paint, 300);
  })();
</script>`;

/** Normalises an href so "./styles.css" and "styles.css" find the same file. */
export function normalizeHref(href: string): string {
  return href
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split(/[?#]/)[0]
    .trim();
}

/**
 * Normalises single-page model output: drops markdown fences, leading prose and
 * trailing chatter so only markup remains.
 */
export function cleanGeneratedHtml(raw: string): string {
  let out = raw.replace(/\r\n/g, "\n").trim();
  if (!out) return "";

  const fenced = out.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) out = fenced[1].trim();
  else out = out.replace(/^```[a-zA-Z]*\s*\n?/, "").trim();
  out = out.replace(/\n?```\s*$/, "").trim();

  const firstTag = out.search(
    /<(!doctype|html|head|body|main|div|section|header|nav|aside|footer|style|script|h1|p|a|button|form|svg|table|ul)\b/i,
  );
  if (firstTag > 0) out = out.slice(firstTag).trim();

  const lastClose = out.lastIndexOf(">");
  if (lastClose > 0 && lastClose < out.length - 1) out = out.slice(0, lastClose + 1).trim();

  return out;
}

/** Adds the runtime the document needs without imposing any design tokens. */
function withRuntime(documentHtml: string): string {
  let html = documentHtml;

  if (!html.includes("cdn.tailwindcss.com") && /\bclass=/.test(html)) {
    const tag = `<script src="${TAILWIND_CDN}"></script>`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tag}\n</head>`) : `${tag}\n${html}`;
  }

  if (html.includes("data-lucide") && !html.includes("lucide")) {
    const tag = `<script src="${LUCIDE_CDN}"></script>`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tag}\n</head>`) : `${tag}\n${html}`;
  }

  if (!/<meta[^>]+viewport/i.test(html)) {
    const meta = `<meta name="viewport" content="width=device-width, initial-scale=1" />`;
    html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (match) => `${match}\n${meta}`) : `${meta}\n${html}`;
  }

  if (!/<\/body>/i.test(html) && html.includes("data-lucide")) {
    html = `${html}\n${LUCIDE_BOOT}`;
  } else if (html.includes("data-lucide")) {
    html = html.replace(/<\/body>/i, `${LUCIDE_BOOT}\n</body>`);
  }

  return html;
}

function wrapFragment(fragment: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview</title>
  <script src="${TAILWIND_CDN}"></script>
  ${BASE_STYLE}
</head>
<body>
${fragment}
<script src="${LUCIDE_CDN}"></script>
${LUCIDE_BOOT}
</body>
</html>`;
}

export const EMPTY_PREVIEW_DOCUMENT = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${BASE_STYLE}</head><body></body></html>`;

/**
 * Live preview: inlines the bundle's local CSS and JS into the entry page so a
 * multi-file project renders from a single Blob URL, with no server round-trip
 * and no build step. Cross-page links only work once the bundle is served from
 * storage (`/api/preview/<id>/`); during streaming they are inert.
 */
export function buildInlinePreview(bundle: FileBundle): string {
  const entry =
    bundle.files.find((file) => file.path === bundle.entry) ?? bundle.files[0] ?? null;
  if (!entry || !entry.content.trim()) return EMPTY_PREVIEW_DOCUMENT;

  const map = new Map(bundle.files.map((file) => [normalizeHref(file.path), file.content]));
  let html = entry.content;

  html = html.replace(/<link\b[^>]*>/gi, (tag) => {
    if (!/stylesheet/i.test(tag)) return tag;
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) return tag;
    const css = map.get(normalizeHref(href));
    return css ? `<style>\n${css}\n</style>` : tag;
  });

  html = html.replace(
    /<script\b([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, before: string, src: string) => {
      const js = map.get(normalizeHref(src));
      return js ? `<script>\n${js}\n</script>` : tag;
    },
  );

  const looksComplete = /<html[\s>]/i.test(html) || /<!doctype/i.test(html);
  const document = looksComplete
    ? /<\/head>/i.test(html)
      ? html
      : html.replace(/<html[^>]*>/i, (match) => `${match}\n<head>${BASE_STYLE}</head>`)
    : wrapFragment(html);

  return withRuntime(document);
}

/** Single-file fallback (legacy projects and plain HTML answers). */
export function buildPreviewDocument(code: string): string {
  const cleaned = cleanGeneratedHtml(code);
  if (!cleaned) return EMPTY_PREVIEW_DOCUMENT;
  const looksComplete = /<html[\s>]/i.test(cleaned) || /<!doctype/i.test(cleaned);
  return withRuntime(looksComplete ? cleaned : wrapFragment(cleaned));
}

/** Byte size of generated output, for the preview toolbar. */
export function formatBytes(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

export function formatBytesNumber(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}

