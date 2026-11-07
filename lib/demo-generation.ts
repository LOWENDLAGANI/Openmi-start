/**
 * Placeholder project used when no AI key is configured. It streams the same
 * multi-file format a real model would, so parsing, live preview and chat all
 * behave exactly as they do in production.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function headline(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, " ");
  if (!trimmed) return "A placeholder page, streamed file by file.";
  return trimmed.length > 80 ? `${trimmed.slice(0, 80).trim()}…` : trimmed;
}

export function buildDemoBundle(prompt: string): string {
  const title = escapeHtml(headline(prompt));

  const index = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Demo build — Openmi</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="bar">
    <span class="mark">◍</span>
    <span class="wordmark">Placeholder Studio</span>
    <nav>
      <a href="index.html">Work</a>
      <a href="about.html">About</a>
    </nav>
  </header>

  <main>
    <p class="kicker">Demo generation · no AI key</p>
    <h1>${title}</h1>
    <p class="lede">
      This project was streamed by Openmi's placeholder generator. Two files arrived, the preview
      resolved <code>styles.css</code> on its own, and the about page exists too.
    </p>
    <div class="actions">
      <a class="primary" href="about.html">Open the second page</a>
      <button class="ghost" id="counter" type="button">Clicked 0 times</button>
    </div>

    <section class="strip">
      <article><span>01</span><h2>Files, not blobs</h2><p>The model returns a file bundle; each page is served from storage.</p></article>
      <article><span>02</span><h3>Its own look</h3><p>Nothing here borrows Openmi's cream-and-orange palette.</p></article>
      <article><span>03</span><h3>Editable</h3><p>Send a correction in the chat and the project is rewritten in place.</p></article>
    </section>
  </main>

  <footer>Add a DEEPSEEK_API_KEY to replace this with a real generation.</footer>
  <script src="app.js"></script>
</body>
</html>`;

  const about = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>About — Placeholder Studio</title>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <header class="bar">
    <span class="mark">◍</span>
    <span class="wordmark">Placeholder Studio</span>
    <nav><a href="index.html">Work</a><a href="about.html">About</a></nav>
  </header>
  <main class="narrow">
    <p class="kicker">Second page</p>
    <h1>Multi-page output, one preview.</h1>
    <p class="lede">This file exists to prove relative links work — the navigation above is a real page load, not an anchor.</p>
    <p><a class="primary" href="index.html">Back to the first page</a></p>
  </main>
  <footer>Placeholder build</footer>
</body>
</html>`;

  const styles = `:root {
  --ink: #12100e;
  --paper: #f6f1e7;
  --violet: #5b3df5;
  --line: rgba(18, 16, 14, 0.18);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, system-ui, sans-serif;
  font-weight: 300;
  line-height: 1.6;
}
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 1.25rem clamp(1.25rem, 5vw, 3rem);
  border-bottom: 1px solid var(--line);
}
.mark { color: var(--violet); font-size: 1.4rem; }
.wordmark { font-weight: 500; letter-spacing: -0.01em; margin-right: auto; }
nav { display: flex; gap: 1.25rem; font-size: 0.85rem; }
nav a { color: inherit; text-decoration: none; opacity: 0.65; }
nav a:hover { opacity: 1; }
main { padding: clamp(2.5rem, 8vw, 6rem) clamp(1.25rem, 5vw, 3rem); max-width: 62rem; }
main.narrow { max-width: 40rem; }
.kicker {
  font-size: 0.7rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #8a8378;
}
h1 {
  font-family: "Instrument Serif", Georgia, serif;
  font-weight: 400;
  font-size: clamp(2.5rem, 7vw, 5rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
  margin: 0.6rem 0 1rem;
  max-width: 22ch;
}
h2, h3 { font-family: "Instrument Serif", Georgia, serif; font-weight: 400; font-size: 1.4rem; margin: 0.4rem 0; }
.lede { font-size: 1.05rem; max-width: 46ch; color: #3c3630; }
code { background: rgba(91, 61, 245, 0.1); padding: 0.1em 0.35em; border-radius: 4px; font-size: 0.9em; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 2rem 0 3rem; }
.primary, .ghost {
  display: inline-block;
  border-radius: 999px;
  padding: 0.7rem 1.4rem;
  font-size: 0.9rem;
  text-decoration: none;
  border: 1px solid var(--violet);
}
.primary { background: var(--violet); color: #fff; }
.ghost { background: transparent; color: var(--violet); cursor: pointer; font-family: inherit; }
.strip { display: grid; gap: 1.5rem; border-top: 1px solid var(--line); padding-top: 2rem; }
.strip article span { font-variant-numeric: tabular-nums; color: var(--violet); font-size: 0.75rem; }
.strip p { margin: 0.35rem 0 0; color: #4b453e; font-size: 0.95rem; }
footer {
  border-top: 1px solid var(--line);
  padding: 1.5rem clamp(1.25rem, 5vw, 3rem);
  font-size: 0.75rem;
  color: #8a8378;
}
@media (min-width: 720px) { .strip { grid-template-columns: repeat(3, 1fr); } }
`;

  const app = `document.getElementById("counter")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  const next = (Number(button.dataset.count || 0) + 1);
  button.dataset.count = String(next);
  button.textContent = \`Clicked \${next} time\${next === 1 ? "" : "s"}\`;
});
`;

  return [
    `<<<FILE path="index.html">>>\n${index}\n<<<END FILE>>>`,
    `<<<FILE path="about.html">>>\n${about}\n<<<END FILE>>>`,
    `<<<FILE path="styles.css">>>\n${styles}\n<<<END FILE>>>`,
    `<<<FILE path="app.js">>>\n${app}\n<<<END FILE>>>`,
    "",
  ].join("\n");
}

/** Streams the placeholder bundle in small chunks like a real provider would. */
export function demoGenerationStream(prompt: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const bundle = buildDemoBundle(prompt);
  const chunkSize = 220;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let index = 0; index < bundle.length; index += chunkSize) {
        controller.enqueue(encoder.encode(bundle.slice(index, index + chunkSize)));
        await new Promise((resolve) => setTimeout(resolve, 12));
      }
      controller.close();
    },
  });
}
