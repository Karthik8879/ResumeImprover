import type { JobAnalysis } from "../types/analysis";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Parse and validate model JSON into JobAnalysis; throws on invalid shape. */
export function parseJobAnalysisJson(raw: string): JobAnalysis {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Model returned invalid JSON.");
  }

  if (!isRecord(data)) throw new Error("Model JSON must be an object.");

  const matchScore = data.matchScore;
  if (typeof matchScore !== "number" || Number.isNaN(matchScore)) {
    throw new Error("Missing or invalid matchScore.");
  }

  const bullets = data.resumeBullets;
  if (!Array.isArray(bullets) || !bullets.every((b) => typeof b === "string")) {
    throw new Error("resumeBullets must be an array of strings.");
  }

  const tailoredResumeFullText = data.tailoredResumeFullText;
  if (typeof tailoredResumeFullText !== "string" || !tailoredResumeFullText.trim()) {
    throw new Error("tailoredResumeFullText must be a non-empty string.");
  }

  const answers = data.answers;
  if (!isRecord(answers)) throw new Error("Missing answers object.");

  const whyHire = answers.whyHire;
  const relevantExperience = answers.relevantExperience;
  const strengths = answers.strengths;
  if (typeof whyHire !== "string" || typeof relevantExperience !== "string" || typeof strengths !== "string") {
    throw new Error("answers must include whyHire, relevantExperience, strengths strings.");
  }

  const assumptions = data.assumptions;
  const out: JobAnalysis = {
    matchScore: Math.min(100, Math.max(0, Math.round(matchScore))),
    resumeBullets: bullets.map((b) => b.trim()).filter(Boolean),
    tailoredResumeFullText: tailoredResumeFullText.trim(),
    answers: {
      whyHire: whyHire.trim(),
      relevantExperience: relevantExperience.trim(),
      strengths: strengths.trim(),
    },
  };
  if (typeof assumptions === "string" && assumptions.trim()) {
    out.assumptions = assumptions.trim();
  }
  return out;
}
