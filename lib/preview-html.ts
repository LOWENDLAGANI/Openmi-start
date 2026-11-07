/**
 * Pure string helpers for turning model output into a runnable document.
 * Used by the client preview (Blob URL) and the published viewer (srcDoc).
 */

const TAILWIND_CDN = "https://cdn.tailwindcss.com";
const LUCIDE_CDN = "https://unpkg.com/lucide@latest/dist/umd/lucide.min.js";
const FONTS_LINK =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

const FONT_CONFIG = `<script>tailwind.config={theme:{extend:{fontFamily:{sans:["Space Grotesk","ui-sans-serif","system-ui","sans-serif"],mono:["IBM Plex Mono","ui-monospace","monospace"]},colors:{paper:"#F3F3EE",ink:"#302B28",line:"#CECEBF",brand:"#F43E01"}}}}</script>`;

const BASE_STYLE = `<style>
    :root { color-scheme: light; }
    html { scroll-behavior: smooth; background: #F3F3EE; }
    body { margin: 0; }
    ::-webkit-scrollbar { width: 10px; height: 10px; }
    ::-webkit-scrollbar-thumb { background: #CECEBF; }
    ::-webkit-scrollbar-track { background: #F3F3EE; }
  </style>`;

/**
 * Normalises streamed model output: drops markdown fences, leading prose and
 * trailing chatter so only markup remains.
 */
export function cleanGeneratedHtml(raw: string): string {
  let out = raw.replace(/\r\n/g, "\n").trim();
  if (!out) return "";

  // A complete fenced block: ```html ... ```
  const fenced = out.match(/^```[a-zA-Z]*\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) out = fenced[1].trim();
  // A still-streaming opening fence.
  else out = out.replace(/^```[a-zA-Z]*\s*\n?/, "").trim();
  // A dangling closing fence.
  out = out.replace(/\n?```\s*$/, "").trim();

  // Drop any prose before the first tag.
  const firstTag = out.search(
    /<(!doctype|html|head|body|main|div|section|header|nav|aside|footer|style|script|h1|p|a|button|form|svg|table|ul)\b/i,
  );
  if (firstTag > 0) out = out.slice(firstTag).trim();

  // Drop prose after the last tag.
  const lastClose = out.lastIndexOf(">");
  if (lastClose > 0 && lastClose < out.length - 1) out = out.slice(0, lastClose + 1).trim();

  return out;
}

/** Adds the shared CDN assets to a full document produced by the model. */
function withAssets(documentHtml: string): string {
  let html = documentHtml;

  if (!html.includes("cdn.tailwindcss.com")) {
    const tailwind = `<script src="${TAILWIND_CDN}"></script>${FONT_CONFIG}`;
    html = /<\/head>/i.test(html)
      ? html.replace(/<\/head>/i, `  ${tailwind}\n</head>`)
      : `${tailwind}\n${html}`;
  }

  if (!html.includes("fonts.googleapis.com/css2")) {
    const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="stylesheet" href="${FONTS_LINK}" />`;
    html = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `  ${fonts}\n</head>`) : `${fonts}\n${html}`;
  }

  if (!html.includes("lucide")) {
    const lucide = `<script src="${LUCIDE_CDN}"></script>\n<script>window.lucide?.createIcons?.();</script>`;
    html = /<\/body>/i.test(html)
      ? html.replace(/<\/body>/i, `${lucide}\n</body>`)
      : `${html}\n${lucide}`;
  }

  return html;
}

function wrap(fragment: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Openmi preview</title>
  <script src="${TAILWIND_CDN}"></script>
  ${FONT_CONFIG}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="${FONTS_LINK}" />
  ${BASE_STYLE}
</head>
<body class="bg-paper font-sans text-ink antialiased">
${fragment}
<script src="${LUCIDE_CDN}"></script>
<script>
  (function () {
    function paint() { try { window.lucide && window.lucide.createIcons(); } catch (e) {} }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", paint);
    } else {
      paint();
    }
    setTimeout(paint, 150);
  })();
</script>
</body>
</html>`;
}

export const EMPTY_PREVIEW_DOCUMENT = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="${TAILWIND_CDN}"></script>${BASE_STYLE}</head>
<body class="bg-paper"></body></html>`;

/** Builds the HTML document that actually runs inside the iframe. */
export function buildPreviewDocument(code: string): string {
  const cleaned = cleanGeneratedHtml(code);
  if (!cleaned) return EMPTY_PREVIEW_DOCUMENT;

  const looksComplete = /<html[\s>]/i.test(cleaned) || /<!doctype/i.test(cleaned);
  return looksComplete ? withAssets(cleaned) : wrap(cleaned);
}

/** Byte size of the generated code, for the preview toolbar. */
export function formatBytes(value: string): string {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} kB`;
}
