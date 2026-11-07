/**
 * Live research for the generator. When EXA_API_KEY is set, every build request
 * first runs a web search and feeds a compact brief (snippets, source links,
 * image URLs) into the model prompt. Without a key everything still works —
 * the model just designs from the prompt alone.
 *
 * Key setup: https://exa.ai — `EXA_API_KEY` (server only).
 */

const EXA_ENDPOINT = "https://api.exa.ai/search";
const RESEARCH_TIMEOUT_MS = 7_000;

export function researchEnabled(): boolean {
  return Boolean(process.env.EXA_API_KEY?.trim());
}

type ExaResult = {
  title?: string;
  url?: string;
  text?: string;
  highlights?: string[];
  image?: string;
};

export type ResearchBrief = {
  enabled: boolean;
  sources: Array<{ title: string; url: string; snippet: string; imageUrl?: string }>;
  prompt: string;
};

function compact(value: string, limit: number): string {
  const single = value.replace(/\s+/g, " ").trim();
  return single.length > limit ? `${single.slice(0, limit).trim()}…` : single;
}

/** Turns the user's request into a search query with useful visual context. */
function searchQuery(prompt: string): string {
  return `${prompt} — website design inspiration, brand style, imagery`;
}

export async function researchBrief(prompt: string): Promise<ResearchBrief> {
  const apiKey = process.env.EXA_API_KEY?.trim();
  if (!apiKey) return { enabled: false, sources: [], prompt: "" };

  try {
    const response = await fetch(EXA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({
        query: searchQuery(prompt),
        numResults: 4,
        type: "auto",
        contents: {
          text: { maxCharacters: 700 },
          highlights: { numSentences: 2 },
          imageLinks: 1,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(RESEARCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error("[openmi] research request failed", response.status, (await response.text().catch(() => "")).slice(0, 200));
      return { enabled: true, sources: [], prompt: "" };
    }

    const data = (await response.json()) as { results?: ExaResult[] };
    const sources = (data.results ?? [])
      .filter((result) => typeof result.url === "string" && result.url)
      .slice(0, 4)
      .map((result) => ({
        title: compact(result.title ?? result.url ?? "", 90),
        url: result.url as string,
        snippet: compact(result.highlights?.join(" ") || result.text || "", 420),
        imageUrl: typeof result.image === "string" && result.image ? result.image : undefined,
      }));

    if (!sources.length) return { enabled: true, sources: [], prompt: "" };

    const images = sources.map((source) => source.imageUrl).filter((url): url is string => Boolean(url));

    const brief = [
      "LIVE WEB RESEARCH (collected just now — use it as material, never quote it verbatim as the brand's own copy):",
      ...sources.map(
        (source, index) =>
          `[${index + 1}] ${source.title} (${source.url})\n    ${source.snippet}`,
      ),
      images.length
        ? `\nIMAGE URLS you may hotlink directly in <img src=\"...\"> (use these exact URLs, do not invent others):\n${images
            .map((url) => `- ${url}`)
            .join("\n")}`
        : "\nNo stock image URLs were returned — prefer CSS gradients, SVG art or img URLs you are confident exist.",
      "",
    ].join("\n");

    return { enabled: true, sources, prompt: brief };
  } catch (error) {
    console.error("[openmi] research unavailable", error);
    return { enabled: true, sources: [], prompt: "" };
  }
}
