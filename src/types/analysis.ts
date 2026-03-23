/** Structured LLM output after analyzing a job description. */
export type JobAnalysis = {
  matchScore: number;
  resumeBullets: string[];
  /** Full plain-text resume tailored from the user's default resume + JD */
  tailoredResumeFullText: string;
  answers: {
    whyHire: string;
    relevantExperience: string;
    strengths: string;
  };
  assumptions?: string;
};
