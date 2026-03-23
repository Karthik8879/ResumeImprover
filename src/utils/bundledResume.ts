import type { ResumeProfile } from "../types/storage";

/** Load plain-text resume shipped with the extension (dist/resumes/<profile>.txt). */
export async function fetchBundledResume(profile: Exclude<ResumeProfile, "custom">): Promise<string> {
  const url = chrome.runtime.getURL(`resumes/${profile}.txt`);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bundled resume not found (${profile}). Rebuild so extension/resumes is copied to dist/resumes.`);
  }
  return (await res.text()).trim();
}
