/**
 * Server-side resolution of the AI provider. Only the route handler imports
 * this module: keys must never reach the browser.
 */

export type AiProviderId = "deepseek" | "openai" | "none";

/** Safe, non-secret summary passed to the client. */
export type AiStatus = {
  configured: boolean;
  provider: AiProviderId;
  label: string;
  model: string | null;
  /** Live web research (Exa) is available for prompt grounding. */
  research: boolean;
};

export type ResolvedProvider = {
  status: AiStatus;
  apiKey: string | null;
  baseUrl: string;
  model: string;
  /** Output budget for one build, from this provider's own ceiling. */
  maxOutputTokens: number;
  /** Provider-specific request fields merged into the chat completion body. */
  extraBody: Record<string, unknown>;
};

/**
 * Output budget for one build. Each provider caps this itself, and a complete
 * multi-file site needs the room: a truncated stylesheet is what a half-styled
 * page looks like. AI_MAX_TOKENS overrides the ceiling for every provider.
 */
function outputBudget(providerDefault: number): number {
  const configured = Number(process.env.AI_MAX_TOKENS?.trim());
  return Number.isFinite(configured) && configured >= 1000 ? Math.min(configured, 64_000) : providerDefault;
}

const DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEEPSEEK_MODEL = "deepseek-flash";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_MODEL = "gpt-4o-mini";

/**
 * Priority: DeepSeek, then any OpenAI-compatible key. DeepSeek's API is
 * OpenAI-compatible, so the streaming proxy is identical for both.
 */
export function resolveAiProvider(): ResolvedProvider {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (deepseekKey) {
    const baseUrl = process.env.DEEPSEEK_BASE_URL?.trim() || DEEPSEEK_BASE_URL;
    const model = process.env.DEEPSEEK_MODEL?.trim() || DEEPSEEK_MODEL;
    // Flash thinks by default; UI generation wants fast first tokens.
    const thinking = process.env.DEEPSEEK_THINKING?.trim().toLowerCase() === "enabled";

    return {
      status: { configured: true, provider: "deepseek", label: "DeepSeek", model, research: false },
      apiKey: deepseekKey,
      baseUrl,
      model,
      maxOutputTokens: outputBudget(8000),
      extraBody: { thinking: { type: thinking ? "enabled" : "disabled" } },
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    const baseUrl = process.env.OPENAI_BASE_URL?.trim() || OPENAI_BASE_URL;
    const model = process.env.OPENAI_MODEL?.trim() || OPENAI_MODEL;

    return {
      status: { configured: true, provider: "openai", label: "OpenAI", model, research: false },
      apiKey: openaiKey,
      baseUrl,
      model,
      maxOutputTokens: outputBudget(16_000),
      extraBody: {},
    };
  }

  return {
    status: { configured: false, provider: "none", label: "Demo generator", model: null, research: false },
    apiKey: null,
    baseUrl: "",
    model: "",
    maxOutputTokens: 8000,
    extraBody: {},
  };
}

/** Convenience helper for server components that only need the public summary. */
export function aiStatus(): AiStatus {
  const status = resolveAiProvider().status;
  return { ...status, research: Boolean(process.env.EXA_API_KEY?.trim()) };
}
