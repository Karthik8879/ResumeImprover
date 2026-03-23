import type { ApplicationRecord } from "../types/storage";
import { excerpt } from "../utils/text";
import { STORAGE_APPLICATIONS_KEY } from "./keys";

async function readAll(): Promise<ApplicationRecord[]> {
  const bag = await chrome.storage.local.get(STORAGE_APPLICATIONS_KEY);
  const list = bag[STORAGE_APPLICATIONS_KEY];
  return Array.isArray(list) ? (list as ApplicationRecord[]) : [];
}

export async function listApplications(): Promise<ApplicationRecord[]> {
  const list = await readAll();
  return [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveApplication(record: Omit<ApplicationRecord, "id" | "createdAt"> & { id?: string }): Promise<ApplicationRecord> {
  const list = await readAll();
  const now = new Date().toISOString();
  const full: ApplicationRecord = {
    id: record.id ?? crypto.randomUUID(),
    createdAt: now,
    url: record.url,
    company: record.company,
    role: record.role,
    appliedAt: record.appliedAt,
    answers: record.answers,
    jdExcerpt: excerpt(record.jdExcerpt, 4000),
  };
  list.unshift(full);
  await chrome.storage.local.set({ [STORAGE_APPLICATIONS_KEY]: list.slice(0, 200) });
  return full;
}

export async function exportApplicationsJson(): Promise<string> {
  const list = await readAll();
  return JSON.stringify(list, null, 2);
}
