/** Version tag for debugging prompt iterations. */
export const PROMPT_VERSION = "v3";

const SYSTEM = `You are an expert career coach helping a candidate apply to a specific job.
You must output valid JSON only, with no markdown fences or commentary.
Ground every claim in the candidate's supplied resume text and notes; do not invent employers, degrees, dates, or tools they did not state.
Keep tone concise, human, and confident — not generic filler.
Rewrite the resume to align with the job description using truthful reframing and emphasis, not fabrication.
If the job description is thin, still produce the JSON shape using careful inference and note assumptions in "assumptions".`;

/**
 * Builds user message: default resume + optional notes + JD → JSON with full tailored resume text.
 */
export function buildAnalyzeUserMessage(
  jobDescription: string,
  defaultResumeText: string,
  userProfileSummary: string
): string {
  const resumeBlock =
    defaultResumeText.trim().length > 0
      ? `Candidate default resume (plain text — preserve structure and facts; tailor wording to the JD):\n"""${defaultResumeText.trim()}"""\n\n`
      : "No default resume text was provided — derive bullets and tailoredResumeFullText only from optional notes and the JD, staying non-specific where needed.\n\n";

  const notesBlock =
    userProfileSummary.trim().length > 0
      ? `Additional notes / constraints:\n${userProfileSummary.trim()}\n\n`
      : "";

  return `${resumeBlock}${notesBlock}Job description:\n"""${jobDescription.trim()}"""\n\nReturn a JSON object with exactly these keys:
{
  "matchScore": number from 0-100 estimating fit given the resume and JD,
  "resumeBullets": string array of 4-6 tailored resume bullet points (each <= 2 short sentences, start with strong verbs),
  "tailoredResumeFullText": string, plain text for one-page A4 LaTeX export: line 1 = full name; contact lines (email/phone first; keep links concise — prefer LinkedIn, GitHub, and top 2–3 project URLs only); ALL CAPS sections PROFESSIONAL SUMMARY (short paragraph), EDUCATION, PROFESSIONAL EXPERIENCE, TECHNICAL SKILLS, KEY PROJECTS, ACHIEVEMENTS; EXPERIENCE = job title line, company line, date line, then max 2–3 tight bullets per role (impact-first, minimal filler); PROJECTS = at most 3 strongest projects, each with title line (use -- in title), URL line, max 2 bullets; SKILLS = merge into at most 4 lines (e.g. Languages/Frontend, Backend/Data, Cloud/DevOps, ML/AI); omit low-value education notes; same facts as default resume but JD-aligned and concise,
  "answers": {
    "whyHire": string, answer to "Why should we hire you?" (120-180 words max),
    "relevantExperience": string, focused relevant experience narrative (120-180 words max),
    "strengths": string, key strengths for this role (80-140 words max)
  },
  "assumptions": string, optional short note on what you inferred if data was missing
}`;
}

export function analyzeSystemPrompt(): string {
  return `${SYSTEM} Prompt version: ${PROMPT_VERSION}.`;
}
