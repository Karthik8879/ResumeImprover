import { analyzeSystemPrompt, buildAnalyzeUserMessage } from "../prompts/analyzeJob";
import type { JobAnalysis } from "../types/analysis";
import { parseJobAnalysisJson } from "./parseAnalysis";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function analyzeWithOpenAI(params: {
  apiKey: string;
  model: string;
  jobDescription: string;
  defaultResumeText: string;
  userProfileSummary: string;
  signal?: AbortSignal;
}): Promise<JobAnalysis> {
  const { apiKey, model, jobDescription, defaultResumeText, userProfileSummary, signal } = params;
  if (!apiKey) throw new Error("OpenAI API key is not set.");

  const body = {
    model,
    temperature: 0.4,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system" as const, content: analyzeSystemPrompt() },
      {
        role: "user" as const,
        content: buildAnalyzeUserMessage(jobDescription, defaultResumeText, userProfileSummary),
      },
    ],
  };

  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`OpenAI error ${res.status}: ${errText.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI.");

  return parseJobAnalysisJson(content);
}
