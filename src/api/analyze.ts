import type { JobAnalysis } from "../types/analysis";
import type { ExtensionSettings } from "../types/storage";
import { analyzeWithAnthropic } from "./anthropic";
import { analyzeWithOpenAI } from "./openai";
import { analyzeWithOpenRouter } from "./openrouter";

/**
 * Single entry: chooses provider from settings and returns structured analysis.
 */
export async function analyzeJobDescription(
  jobDescription: string,
  settings: ExtensionSettings,
  signal?: AbortSignal
): Promise<JobAnalysis> {
  const summary = settings.userProfileSummary ?? "";
  const defaultResume = settings.defaultResumeText ?? "";
  if (!jobDescription.trim()) throw new Error("Job description is empty.");

  if (settings.provider === "openai") {
    return analyzeWithOpenAI({
      apiKey: settings.openaiApiKey,
      model: settings.openaiModel,
      jobDescription,
      defaultResumeText: defaultResume,
      userProfileSummary: summary,
      signal,
    });
  }

  if (settings.provider === "openrouter") {
    return analyzeWithOpenRouter({
      apiKey: settings.openrouterApiKey ?? "",
      model: settings.openrouterModel ?? "",
      jobDescription,
      defaultResumeText: defaultResume,
      userProfileSummary: summary,
      signal,
    });
  }

  return analyzeWithAnthropic({
    apiKey: settings.anthropicApiKey,
    model: settings.anthropicModel,
    jobDescription,
    defaultResumeText: defaultResume,
    userProfileSummary: summary,
    signal,
  });
}
