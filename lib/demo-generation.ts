/**
 * Placeholder design used when OPENAI_API_KEY is missing, streamed token by
 * token so the live preview behaves exactly like a real generation.
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
  if (!trimmed) return "Your interface, generated in seconds.";
  return trimmed.length > 88 ? `${trimmed.slice(0, 88).trim()}…` : trimmed;
}

export function buildDemoMarkup(prompt: string): string {
  const title = escapeHtml(headline(prompt));

  return `<div class="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
  <div class="pointer-events-none absolute -top-48 left-1/2 h-[440px] w-[860px] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-[130px]"></div>
  <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"></div>

  <header class="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
    <div class="flex items-center gap-2.5">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-emerald-400/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
        <i data-lucide="sparkles" class="h-[18px] w-[18px]"></i>
      </span>
      <span class="text-sm font-semibold tracking-tight">Northwind Studio</span>
    </div>
    <nav class="hidden items-center gap-8 text-sm text-slate-400 md:flex">
      <a href="#features" class="transition hover:text-white">Features</a>
      <a href="#metrics" class="transition hover:text-white">Metrics</a>
      <a href="#faq" class="transition hover:text-white">FAQ</a>
    </nav>
    <button class="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10">Get started</button>
  </header>

  <main class="relative z-10 mx-auto max-w-6xl px-6 pb-24">
    <section class="pt-14 text-center sm:pt-24">
      <span class="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-300">
        <span class="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400"></span>
        Demo generation
      </span>
      <h1 class="mx-auto mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">${title}</h1>
      <p class="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-400">This placeholder was streamed by Openmi's demo generator. Add an <code class="rounded bg-white/10 px-1.5 py-0.5 text-[13px] text-emerald-300">OPENAI_API_KEY</code> to swap it for real, model-written interfaces.</p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button id="demo-cta" class="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300 active:scale-[0.99]">
          <i data-lucide="zap" class="h-4 w-4"></i>
          <span id="demo-cta-label">Try the button</span>
        </button>
        <a href="#features" class="inline-flex items-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-medium text-slate-300 transition hover:border-white/20 hover:text-white">
          See how it works <i data-lucide="arrow-right" class="h-4 w-4"></i>
        </a>
      </div>
    </section>

    <section id="features" class="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <article class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-emerald-400/30">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-emerald-300"><i data-lucide="zap" class="h-5 w-5"></i></span>
        <h2 class="mt-4 text-base font-semibold">Instant previews</h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">Every token lands in a sandboxed iframe the moment it arrives.</p>
      </article>
      <article class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-emerald-400/30">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-cyan-300"><i data-lucide="layout-dashboard" class="h-5 w-5"></i></span>
        <h2 class="mt-4 text-base font-semibold">Real Tailwind</h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">Designs ship as plain HTML with the Tailwind CDN, ready to copy anywhere.</p>
      </article>
      <article class="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-emerald-400/30 sm:col-span-2 lg:col-span-1">
        <span class="grid h-10 w-10 place-items-center rounded-xl bg-white/5 text-violet-300"><i data-lucide="share-2" class="h-5 w-5"></i></span>
        <h2 class="mt-4 text-base font-semibold">Shareable links</h2>
        <p class="mt-2 text-sm leading-relaxed text-slate-400">Publish to a permanent /p/ link that anyone can open.</p>
      </article>
    </section>

    <section id="metrics" class="mt-6 grid gap-6 rounded-3xl border border-white/10 bg-white/[0.03] p-8 sm:grid-cols-3">
      <div>
        <p class="text-3xl font-semibold tracking-tight">12s</p>
        <p class="mt-1 text-sm text-slate-400">to a first draft</p>
      </div>
      <div>
        <p class="text-3xl font-semibold tracking-tight">5 / day</p>
        <p class="mt-1 text-sm text-slate-400">free generations</p>
      </div>
      <div>
        <p class="text-3xl font-semibold tracking-tight">0</p>
        <p class="mt-1 text-sm text-slate-400">containers to run</p>
      </div>
    </section>
  </main>
</div>

<script>
  (function () {
    var button = document.getElementById("demo-cta");
    var label = document.getElementById("demo-cta-label");
    var clicks = 0;
    if (button && label) {
      button.addEventListener("click", function () {
        clicks += 1;
        label.textContent = clicks === 1 ? "Nice — clicked once" : "Clicked " + clicks + " times";
      });
    }
  })();
</script>`;
}

const CHUNK_SIZE = 96;

export function demoGenerationStream(prompt: string): ReadableStream<Uint8Array> {
  const html = buildDemoMarkup(prompt);
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (let index = 0; index < html.length; index += CHUNK_SIZE) {
        controller.enqueue(encoder.encode(html.slice(index, index + CHUNK_SIZE)));
        await new Promise((resolve) => setTimeout(resolve, 14));
      }
      controller.close();
    },
  });
}
