import { resolveAiProvider } from "@/lib/ai-config";
import { GENERATION_SYSTEM_PROMPT, GENERATION_USER_PREFIX } from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;
const MAX_PROMPT_LENGTH = 2000;

type RateEntry = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateEntry>();

function allowRequest(key: string): boolean {
  const now = Date.now();
  const entry = rateBuckets.get(key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    if (rateBuckets.size > 500) {
      for (const [k, v] of rateBuckets) if (v.resetAt <= now) rateBuckets.delete(k);
    }
    return true;
  }
  if (entry.count >= RATE_MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

function jsonError(message: string, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra },
  });
}

function textStreamHeaders(generator: string, model: string): HeadersInit {
  return {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store, no-transform",
    "X-Accel-Buffering": "no",
    "X-Openmi-Generator": generator,
    "X-Openmi-Model": model,
  };
}

/**
 * Turns an OpenAI-compatible SSE stream into a plain text stream of HTML
 * tokens, so the browser can simply append chunks to the preview.
 */
function sseToTextStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let out = "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const delta = parsed.choices?.[0]?.delta?.content;
              if (typeof delta === "string") out += delta;
            } catch {
              // Ignore keep-alive comments and partial frames.
            }
          }
          if (out) controller.enqueue(encoder.encode(out));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
    cancel(reason) {
      void source.cancel(reason);
    },
  });
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  const rawPrompt = (payload as { prompt?: unknown } | null)?.prompt;
  const prompt = typeof rawPrompt === "string" ? rawPrompt.trim() : "";

  if (prompt.length < 3) {
    return jsonError("Describe what you want to build (at least 3 characters).", 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(`Keep prompts under ${MAX_PROMPT_LENGTH} characters.`, 400);
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const clientKey = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (!allowRequest(clientKey)) {
    return jsonError("Too many generations in a minute. Take a breath and retry shortly.", 429);
  }

  const provider = resolveAiProvider();

  // No key configured: stream a canned design so the editor stays usable.
  if (!provider.apiKey) {
    const { demoGenerationStream } = await import("@/lib/demo-generation");
    return new Response(demoGenerationStream(prompt), {
      headers: textStreamHeaders("demo", "placeholder"),
    });
  }

  const baseUrl = provider.baseUrl.replace(/\/+$/, "");

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        stream: true,
        temperature: 0.7,
        max_tokens: 4096,
        messages: [
          { role: "system", content: GENERATION_SYSTEM_PROMPT },
          { role: "user", content: `${GENERATION_USER_PREFIX}${prompt}` },
        ],
        ...provider.extraBody,
      }),
      signal: AbortSignal.timeout(55_000),
    });
  } catch (error) {
    console.error("[openmi] provider unreachable", error);
    return jsonError(
      `Could not reach ${provider.status.label}. Check the network and API settings.`,
      502,
      { "X-Openmi-Generator": provider.status.provider },
    );
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("[openmi] provider error", provider.status.provider, upstream.status, detail.slice(0, 500));
    const hint =
      upstream.status === 401 || upstream.status === 403
        ? `${provider.status.label} rejected the API key. Check DEEPSEEK_API_KEY / OPENAI_API_KEY.`
        : upstream.status === 402
          ? `${provider.status.label} reports insufficient balance for this key.`
          : upstream.status === 429
            ? `${provider.status.label} is rate limiting requests. Try again in a moment.`
            : `${provider.status.label} returned an error (${upstream.status}).`;
    return jsonError(hint, 502, { "X-Openmi-Generator": provider.status.provider });
  }

  return new Response(sseToTextStream(upstream.body), {
    headers: textStreamHeaders(provider.status.provider, provider.model),
  });
}
