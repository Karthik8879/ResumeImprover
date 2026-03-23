/** Message types exchanged between popup and content script. */

import type { JobPayload } from "./job";

export const MSG_EXTRACT_JOB = "AI_JOB_ASSISTANT_EXTRACT_JOB" as const;
export const MSG_AUTOFILL_ANSWERS = "AI_JOB_ASSISTANT_AUTOFILL" as const;

export type ExtractJobResponse =
  | { ok: true; payload: JobPayload }
  | { ok: false; error: string };

export type AutofillPayload = {
  whyHire: string;
  relevantExperience: string;
  strengths: string;
};

export type AutofillResponse =
  | { ok: true; filled: { key: string; selector: string }[] }
  | { ok: false; error: string };
