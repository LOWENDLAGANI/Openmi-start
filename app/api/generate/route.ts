import { resolveAiProvider } from "@/lib/ai-config";
import { DAILY_GENERATION_LIMIT } from "@/lib/config";
import { randomProjectId } from "@/lib/backend/types";
import { sanitizePath } from "@/lib/file-bundle";
import { GENERATION_SYSTEM_PROMPT, USER_PREFIX } from "@/lib/prompts";
import { adminAuth, isAdminConfigured } from "@/lib/server/admin";
import { chargeGeneration, readRemaining } from "@/lib/server/quota";
import { researchBrief } from "@/lib/server/research";
import { saveBundle } from "@/lib/server/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 10;
const MAX_PROMPT_LENGTH = 4000;
const MAX_TOTAL_FILE_CHARS = 120_000;
const MAX_FILES = 12;
const MAX_HISTORY = 8;
/** Below this the model produced nothing usable, so nothing is charged. */
const MIN_CHARGEABLE_CHARS = 20;

/**
 * Output budget for one build. A complete multi-file site — page plus its CSS
 * and behaviour — runs long, and a truncated tail is what a half-styled page
 * looks like. Raise AI_MAX_TOKENS when the provider's own cap allows more.
 */
const MAX_OUTPUT_TOKENS = (() => {
  const configured = Number(process.env.AI_MAX_TOKENS?.trim());
  return Number.isFinite(configured) && configured >= 1000 ? Math.min(configured, 64_000) : 8000;
})();

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

type IncomingFile = { path: string; content: string };
type IncomingTurn = { role: "user" | "assistant"; content: string };

function readFiles(value: unknown): IncomingFile[] {
  if (!Array.isArray(value)) return [];
  const files: IncomingFile[] = [];
  let total = 0;
  for (const entry of value.slice(0, MAX_FILES)) {
    const path = typeof (entry as IncomingFile)?.path === "string" ? sanitizePath((entry as IncomingFile).path) : "";
    const content = typeof (entry as IncomingFile)?.content === "string" ? (entry as IncomingFile).content : "";
    if (!path || !content) continue;
    if (total + content.length > MAX_TOTAL_FILE_CHARS) break;
    total += content.length;
    files.push({ path, content });
  }
  return files;
}

function readHistory(value: unknown): IncomingTurn[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((turn): turn is IncomingTurn => {
      const candidate = turn as IncomingTurn | null;
      return Boolean(
        candidate &&
          (candidate.role === "user" || candidate.role === "assistant") &&
          typeof candidate.content === "string" &&
          candidate.content.trim(),
      );
    })
    .slice(-MAX_HISTORY)
    .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1500) }));
}

/**
 * Turns an OpenAI-compatible SSE stream into a plain text stream of the file
 * bundle. `onSuccess` runs once the upstream stream ends normally with real
 * output — before the stream closes, so the settled quota and stored files are
 * in place by the time the browser sees the end of the response.
 */
function sseToTextStream(
  source: ReadableStream<Uint8Array>,
  onSuccess?: (text: string) => Promise<void>,
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();
      let buffer = "";
      let produced = "";
      let settled = false;

      const settle = async () => {
        if (settled) return;
        settled = true;
        if (!onSuccess || produced.length < MIN_CHARGEABLE_CHARS) return;
        try {
          await onSuccess(produced);
        } catch (error) {
          console.error("[openmi] could not settle the generation", error);
        }
      };

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
              produced += out;
              if (out) controller.enqueue(encoder.encode(out));
              await settle();
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
          if (out) {
            produced += out;
            controller.enqueue(encoder.encode(out));
          }
        }

        await settle();
        controller.close();
      } catch (error) {
        // An interrupted generation is not a successful one: no charge, no save.
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

  const body = (payload ?? {}) as {
    prompt?: unknown;
    chatId?: unknown;
    files?: unknown;
    history?: unknown;
  };

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (prompt.length < 3) {
    return jsonError("Describe what you want to build (at least 3 characters).", 400);
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return jsonError(`Keep messages under ${MAX_PROMPT_LENGTH} characters.`, 400);
  }

  const chatId =
    typeof body.chatId === "string" && /^[a-z0-9]{6,40}$/.test(body.chatId)
      ? body.chatId
      : randomProjectId(20);

  const files = readFiles(body.files);
  const history = readHistory(body.history);

  const forwarded = request.headers.get("x-forwarded-for");
  const clientKey = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  if (!allowRequest(clientKey)) {
    return jsonError("Too many generations in a minute. Take a breath and retry shortly.", 429);
  }

  // --- identity + quota ----------------------------------------------------
  const quotaConfigured = isAdminConfigured();
  const authHeader = request.headers.get("authorization") ?? "";
  let actor: { uid: string; email: string | null } | null = null;

  if (authHeader.startsWith("Bearer ")) {
    if (!quotaConfigured) {
      return jsonError(
        "Server quota is not configured. Add FIREBASE_SERVICE_ACCOUNT_KEY to the server environment.",
        503,
      );
    }
    try {
      const decoded = await adminAuth().verifyIdToken(authHeader.slice(7).trim());
      actor = { uid: decoded.uid, email: decoded.email ?? null };
    } catch {
      return jsonError("Your session has expired. Sign in again to keep building.", 401);
    }
  }

  if (quotaConfigured) {
    if (!actor) {
      return jsonError("Sign in to build — credits are charged to your account.", 401);
    }
    const remaining = await readRemaining(actor.uid);
    if (remaining <= 0) {
      return jsonError(
        `Daily limit reached — ${DAILY_GENERATION_LIMIT} generations per day. Your quota resets at midnight UTC.`,
        429,
      );
    }
  }

  const charge = actor
    ? async (text: string) => {
        const { parseFileBundle } = await import("@/lib/file-bundle");
        const bundle = parseFileBundle(text);
        // A conversational reply (a clarifying question, a short answer) ships
        // no files, so there is nothing to store and nothing to charge.
        if (!bundle.files.length) {
          console.info("[openmi] conversational reply — no files, no charge");
          return;
        }
        await saveBundle(chatId, bundle);
        const remaining = await chargeGeneration(actor!.uid, actor!.email);
        console.info(
          `[openmi] charged ${actor!.uid} for ${bundle.files.length} file(s), ${remaining} generation(s) left`,
        );
      }
    : undefined;

  const provider = resolveAiProvider();

  // No key configured: stream a canned multi-file project so the editor stays usable.
  if (!provider.apiKey) {
    const { demoGenerationStream } = await import("@/lib/demo-generation");
    return new Response(demoGenerationStream(prompt), {
      headers: textStreamHeaders("demo", "placeholder"),
    });
  }

  // --- live research -------------------------------------------------------
  const research = await researchBrief(prompt);

  const sections = [prompt];

  if (history.length) {
    sections.push(
      `CONVERSATION SO FAR:\n${history
        .map((turn) => `${turn.role === "user" ? "User" : "Openmi"}: ${turn.content}`)
        .join("\n")}`,
    );
  }

  if (files.length) {
    sections.push(
      `CURRENT FILES — the project so far. Keep what works and return complete updated files:\n${files
        .map((file) => `<<<FILE path="${file.path}">>>\n${file.content}\n<<<END FILE>>>`)
        .join("\n")}`,
    );
  } else {
    sections.push("CURRENT FILES: none — this is a new project. Start with index.html.");
  }

  if (research.prompt) sections.push(research.prompt);

  const userMessage = `${USER_PREFIX}${sections.join("\n\n")}`;
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
        temperature: 0.8,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: "system", content: GENERATION_SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        ...provider.extraBody,
      }),
      signal: AbortSignal.timeout(110_000),
    });
  } catch (error) {
    console.error("[openmi] provider unreachable", error);
    return jsonError(
      `Could not reach ${provider.status.label}. Check the network and API settings.`,
      502,
      { "X-Openmi-Generator": provider.status.provider, "X-Openmi-Chat": chatId },
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
    return jsonError(hint, 502, {
      "X-Openmi-Generator": provider.status.provider,
      "X-Openmi-Chat": chatId,
    });
  }

  return new Response(sseToTextStream(upstream.body, charge), {
    headers: {
      ...textStreamHeaders(provider.status.provider, provider.model),
      "X-Openmi-Chat": chatId,
      "X-Openmi-Research": research.enabled ? (research.sources.length ? "grounded" : "empty") : "off",
    },
  });
}
