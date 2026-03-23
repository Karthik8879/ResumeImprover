import type { ResumePreviewPayload } from "../types/preview";
import { STORAGE_RESUME_PREVIEW_KEY } from "./keys";

export async function saveResumePreviewPayload(payload: ResumePreviewPayload): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_RESUME_PREVIEW_KEY]: payload });
}

export async function loadResumePreviewPayload(): Promise<ResumePreviewPayload | null> {
  const bag = await chrome.storage.local.get(STORAGE_RESUME_PREVIEW_KEY);
  const v = bag[STORAGE_RESUME_PREVIEW_KEY];
  if (!v || typeof v !== "object") return null;
  const p = v as ResumePreviewPayload;
  if (typeof p.bodyText !== "string") return null;
  return p;
}
