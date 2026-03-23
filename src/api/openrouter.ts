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

  let res = await post({
    model: model.trim(),
    messages,
    temperature: 0.4,
    response_format: { type: "json_object" as const },
  });

  if (!res.ok) {
    const errFirst = await res.text().catch(() => "");
    // Many free-tier models still return JSON in text; retry without json_object constraint
    res = await post({
      model: model.trim(),
      messages,
      temperature: 0.4,
    });
    if (!res.ok) {
      const errSecond = await res.text().catch(() => "");
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
