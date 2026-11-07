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
  return trimmed.length > 84 ? `${trimmed.slice(0, 84).trim()}…` : trimmed;
}

export function buildDemoMarkup(prompt: string): string {
  const title = escapeHtml(headline(prompt));

  return `<div class="min-h-screen bg-[#F3F3EE] text-[#302B28]">
  <header class="border-b border-[#CECEBF]">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
      <div class="flex items-center gap-3">
        <span class="grid h-7 w-7 place-items-center rounded-[7px] bg-[#F43E01]">
          <i data-lucide="box" class="h-4 w-4 text-[#302B28]"></i>
        </span>
        <span class="text-lg font-medium tracking-[-0.04em]">Northwind</span>
        <span class="hidden h-4 w-px bg-[#CECEBF] sm:block"></span>
        <span class="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D] sm:block">Platform</span>
      </div>
      <nav class="hidden items-center gap-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D] md:flex">
        <a href="#features" class="hover:text-[#302B28]">Features</a>
        <a href="#numbers" class="hover:text-[#302B28]">Numbers</a>
        <a href="#faq" class="hover:text-[#302B28]">FAQ</a>
      </nav>
      <button class="rounded-full bg-[#F43E01] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#C93300]">Get started</button>
    </div>
  </header>

  <main>
    <section class="mx-auto max-w-6xl px-6 pb-16 pt-14 sm:pt-20">
      <div class="grid items-start gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        <div>
          <span class="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">
            <span class="h-1.5 w-1.5 rounded-full bg-[#F43E01]"></span>
            Demo generation
          </span>
          <h1 class="mt-6 text-[clamp(2.4rem,6vw,4.4rem)] font-normal leading-[0.95] tracking-[-0.04em]">${title}</h1>
          <p class="mt-6 max-w-[40ch] text-[15px] leading-relaxed text-[#69695D]">This placeholder was streamed by Openmi's demo generator. Add an <code class="rounded bg-[#E8E8DE] px-1.5 py-0.5 font-mono text-[12px] text-[#302B28]">OPENAI_API_KEY</code> to swap it for real, model-written interfaces.</p>
          <div class="mt-8 flex flex-wrap items-center gap-3">
            <button id="demo-cta" class="inline-flex items-center gap-2 rounded-full bg-[#F43E01] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#C93300]">
              <i data-lucide="arrow-right" class="h-4 w-4"></i>
              <span id="demo-cta-label">Try the button</span>
            </button>
            <a href="#features" class="inline-flex items-center gap-2 rounded-full border border-[#302B28] px-5 py-3 text-sm font-medium text-[#302B28] transition hover:bg-[#302B28] hover:text-[#F3F3EE]">See how it works</a>
          </div>
        </div>

        <div class="border border-[#CECEBF] bg-[#FAFAF8] p-6">
          <div class="flex items-center justify-between">
            <p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Live throughput</p>
            <span class="h-1.5 w-1.5 rounded-full bg-[#F43E01]"></span>
          </div>
          <p class="mt-4 text-5xl font-normal leading-none tracking-[-0.04em]">1,284</p>
          <p class="mt-2 text-sm text-[#69695D]">tokens per second</p>
          <div class="mt-6 flex items-end gap-1.5 border-t border-[#CECEBF] pt-5">
            <span class="h-10 w-full bg-[#302B28]"></span>
            <span class="h-16 w-full bg-[#302B28]"></span>
            <span class="h-8 w-full bg-[#E8E8DE]"></span>
            <span class="h-20 w-full bg-[#F43E01]"></span>
            <span class="h-12 w-full bg-[#302B28]"></span>
            <span class="h-14 w-full bg-[#302B28]"></span>
          </div>
          <p class="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Last 6 minutes</p>
        </div>
      </div>
    </section>

    <section id="numbers" class="border-y border-[#CECEBF] bg-[#FAFAF8]">
      <div class="mx-auto grid max-w-6xl grid-cols-2 divide-[#CECEBF] px-6 sm:grid-cols-4 sm:divide-x">
        <div class="py-7 sm:px-6"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Latency</p><p class="mt-2 text-3xl tracking-[-0.04em]">&lt;1s</p></div>
        <div class="py-7 sm:px-6"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Build steps</p><p class="mt-2 text-3xl tracking-[-0.04em]">00</p></div>
        <div class="py-7 sm:px-6"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Free / day</p><p class="mt-2 text-3xl tracking-[-0.04em]">05</p></div>
        <div class="py-7 sm:px-6"><p class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">Output</p><p class="mt-2 text-3xl tracking-[-0.04em]">1 file</p></div>
      </div>
    </section>

    <section id="features" class="mx-auto max-w-6xl px-6 py-16">
      <div class="flex flex-wrap items-end justify-between gap-4 border-b border-[#CECEBF] pb-6">
        <h2 class="text-[clamp(1.8rem,4vw,2.8rem)] font-normal leading-none tracking-[-0.04em]">Everything in one file.</h2>
        <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">01 — 03</span>
      </div>
      <div class="grid gap-px bg-[#CECEBF] sm:grid-cols-3">
        <article class="bg-[#F3F3EE] py-7 sm:pr-6">
          <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F43E01]">01</span>
          <h3 class="mt-3 text-lg font-medium">Instant previews</h3>
          <p class="mt-2 text-sm leading-relaxed text-[#69695D]">Every token lands in a sandboxed iframe the moment it arrives.</p>
        </article>
        <article class="bg-[#F3F3EE] py-7 sm:px-6">
          <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F43E01]">02</span>
          <h3 class="mt-3 text-lg font-medium">Real Tailwind</h3>
          <p class="mt-2 text-sm leading-relaxed text-[#69695D]">Plain HTML with the Tailwind CDN, ready to copy anywhere.</p>
        </article>
        <article class="bg-[#F3F3EE] py-7 sm:pl-6">
          <span class="font-mono text-[10px] uppercase tracking-[0.18em] text-[#F43E01]">03</span>
          <h3 class="mt-3 text-lg font-medium">Shareable links</h3>
          <p class="mt-2 text-sm leading-relaxed text-[#69695D]">Publish to a permanent /p/ link that anyone can open.</p>
        </article>
      </div>
    </section>

    <section class="bg-[#F43E01] text-white">
      <div class="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-14 lg:flex-row lg:items-end lg:justify-between">
        <h2 class="max-w-[16ch] text-[clamp(2rem,5vw,3.6rem)] font-normal leading-[0.95] tracking-[-0.04em]">Prompt in. Interface out.</h2>
        <a href="#top" class="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-[#302B28]">Start building <i data-lucide="arrow-right" class="h-4 w-4"></i></a>
      </div>
    </section>
  </main>

  <footer class="border-t border-[#CECEBF]">
    <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[#69695D]">
      <span>Northwind Studio</span>
      <span>Demo output · Openmi</span>
    </div>
  </footer>
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
