import { BUILTIN_OPENROUTER_KEY } from "../constants/builtinOpenRouter";
import { analyzeSystemPrompt, buildAnalyzeUserMessage } from "../prompts/analyzeJob";
import type { JobAnalysis } from "../types/analysis";
import { parseJobAnalysisJson } from "./parseAnalysis";

/** OpenRouter exposes an OpenAI-compatible Chat Completions API. Docs: https://openrouter.ai/docs */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function cleanModelJson(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

/**
 * Analyze JD via OpenRouter — works with Qwen, Llama, Gemma, Mistral, etc.
 * Tries JSON mode first; some free models reject it, so we retry without `response_format`.
 */
export async function analyzeWithOpenRouter(params: {
  apiKey: string;
  model: string;
  jobDescription: string;
  defaultResumeText: string;
  userProfileSummary: string;
  signal?: AbortSignal;
}): Promise<JobAnalysis> {
  const { apiKey, model, jobDescription, defaultResumeText, userProfileSummary, signal } = params;
  const key = apiKey.trim() || BUILTIN_OPENROUTER_KEY;
  if (!key) throw new Error("OpenRouter API key is not set.");

  const messages = [
    { role: "system" as const, content: analyzeSystemPrompt() },
    {
      role: "user" as const,
      content: buildAnalyzeUserMessage(jobDescription, defaultResumeText, userProfileSummary),
    },
  ];

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    // OpenRouter recommends these for attribution (optional but polite)
    "HTTP-Referer": "https://github.com/Karthik8879/ResumeImprover",
    "X-Title": "AI Job Assistant",
  };

  const post = async (body: Record<string, unknown>) =>
    fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });

  const invalidModelHint =
    "OpenRouter: that model id is not recognized. Set Model id to `openrouter/free` (built-in router that picks an available free model) or copy an exact id from https://openrouter.ai/models?free=true";

  const noEndpointsHint =
    "OpenRouter: no provider is serving that model right now (often happens with individual `:free` slugs). " +
    "Set Model id to `openrouter/free` — OpenRouter will route to a working free model. Alternatives: `nvidia/nemotron-3-super-120b-a12b:free`, `minimax/minimax-m2.5:free` (check https://openrouter.ai/models?free=true ).";

  const explainOpenRouterFailure = (status: number, bodySnippet: string): string => {
    if (status === 401) {
      return (
        "OpenRouter returned 401 (User not found / invalid key). " +
        "Sign in at https://openrouter.ai , open https://openrouter.ai/keys , create a new API key, " +
        "paste it into the extension under “OpenRouter API key”, then try Analyze again. " +
        "If you pasted an old or leaked key, revoke it on the Keys page."
      );
    }
    if (status === 400 && /not a valid model/i.test(bodySnippet)) {
      return invalidModelHint;
    }
    if (status === 404 && /no endpoints found/i.test(bodySnippet)) {
      return noEndpointsHint;
    }
    return `OpenRouter HTTP ${status}: ${bodySnippet.slice(0, 220)}`;
  };

  let res = await post({
    model: model.trim(),
    messages,
    temperature: 0.4,
    response_format: { type: "json_object" as const },
  });

  if (!res.ok) {
    const errFirst = await res.text().catch(() => "");
    // Wrong or revoked key — retrying with the same key will not help
    if (res.status === 401) {
      throw new Error(explainOpenRouterFailure(401, errFirst));
    }
    // Bad model id — second request will fail the same way
    if (res.status === 400 && /not a valid model/i.test(errFirst)) {
      throw new Error(explainOpenRouterFailure(400, errFirst));
    }
    if (res.status === 404 && /no endpoints found/i.test(errFirst)) {
      throw new Error(explainOpenRouterFailure(404, errFirst));
    }
    // Many free-tier models reject json_object; retry without it
    res = await post({
      model: model.trim(),
      messages,
      temperature: 0.4,
    });
    if (!res.ok) {
      const errSecond = await res.text().catch(() => "");
      if (res.status === 401) {
        throw new Error(explainOpenRouterFailure(401, errSecond));
      }
      if (res.status === 400 && /not a valid model/i.test(errSecond)) {
        throw new Error(explainOpenRouterFailure(400, errSecond));
      }
      if (res.status === 404 && /no endpoints found/i.test(errSecond)) {
        throw new Error(explainOpenRouterFailure(404, errSecond));
      }
      throw new Error(
        `OpenRouter error: ${errFirst.slice(0, 180)}${errSecond ? ` | retry: ${errSecond.slice(0, 180)}` : ""}`
      );
    }
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
  };
  const raw = json.choices?.[0]?.message?.content;
  if (raw == null || String(raw).trim() === "") {
    throw new Error("Empty response from OpenRouter.");
  }

  const content = cleanModelJson(String(raw));
  return parseJobAnalysisJson(content);
}
