import { analyzeSystemPrompt, buildAnalyzeUserMessage } from "../prompts/analyzeJob";
import type { JobAnalysis } from "../types/analysis";
import { parseJobAnalysisJson } from "./parseAnalysis";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export async function analyzeWithAnthropic(params: {
  apiKey: string;
  model: string;
  jobDescription: string;
  defaultResumeText: string;
  userProfileSummary: string;
  signal?: AbortSignal;
}): Promise<JobAnalysis> {
  const { apiKey, model, jobDescription, defaultResumeText, userProfileSummary, signal } = params;
  if (!apiKey) throw new Error("Anthropic API key is not set.");

  const userContent = buildAnalyzeUserMessage(jobDescription, defaultResumeText, userProfileSummary);

  const body = {
    model,
    max_tokens: 4096,
    temperature: 0.4,
    system: analyzeSystemPrompt(),
    messages: [{ role: "user" as const, content: userContent }],
  };

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Anthropic error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const textBlocks = json.content?.filter((c) => c.type === "text").map((c) => c.text ?? "") ?? [];
  const content = textBlocks.join("").trim();
  if (!content) throw new Error("Empty response from Anthropic.");

  // Strip accidental markdown fences if the model adds them
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return parseJobAnalysisJson(cleaned);
}
