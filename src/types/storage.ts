import type { JobAnalysis } from "./analysis";

export type AiProvider = "openai" | "anthropic";

/** User settings persisted in chrome.storage.local */
export type ExtensionSettings = {
  provider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  /**
   * Full default resume as plain text (paste from PDF/Word or import .txt).
   * Sent to the model with the JD to produce tailoredResumeFullText.
   */
  defaultResumeText: string;
  /** Optional extra context (keywords, constraints) in addition to defaultResumeText */
  userProfileSummary: string;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  provider: "anthropic",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-sonnet-20241022",
  defaultResumeText: "",
  userProfileSummary: "",
};

/** Saved job application record */
export type ApplicationRecord = {
  id: string;
  url: string;
  company: string;
  role: string;
  appliedAt: string | null;
  answers: JobAnalysis["answers"] & {
    resumeBullets: string[];
    matchScore: number;
    tailoredResumeFullText?: string;
  };
  jdExcerpt: string;
  createdAt: string;
};
