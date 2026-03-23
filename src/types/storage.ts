import type { JobAnalysis } from "./analysis";

export type AiProvider = "openai" | "anthropic" | "openrouter";

/** Whose bundled resume to load (see extension/resumes/*.txt → dist/resumes/) */
export type ResumeProfile = "karthik" | "muskan" | "custom";

/** User settings persisted in chrome.storage.local */
export type ExtensionSettings = {
  provider: AiProvider;
  openaiApiKey: string;
  openaiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  /** https://openrouter.ai — one key accesses many models (paste key in the popup; never commit it). */
  openrouterApiKey: string;
  /** Use `openrouter/free` to auto-route to an available free model, or a specific id from openrouter.ai/models */
  openrouterModel: string;
  /**
   * Full default resume as plain text (paste from PDF/Word or import .txt).
   * Sent to the model with the JD to produce tailoredResumeFullText.
   */
  defaultResumeText: string;
  /** Optional extra context (keywords, constraints) in addition to defaultResumeText */
  userProfileSummary: string;
  resumeProfile: ResumeProfile;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  provider: "openrouter",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  anthropicApiKey: "",
  anthropicModel: "claude-3-5-sonnet-20241022",
  openrouterApiKey: "",
  // Default to a Qwen free-tier slug; browse https://openrouter.ai/models?q=free for current IDs
  openrouterModel: "openrouter/free",
  defaultResumeText: "",
  userProfileSummary: "",
  resumeProfile: "karthik",
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
