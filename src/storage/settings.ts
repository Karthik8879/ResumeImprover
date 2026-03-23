import { DEFAULT_SETTINGS, type ExtensionSettings } from "../types/storage";
import { STORAGE_SETTINGS_KEY } from "./keys";

/** Load merged settings from chrome.storage.local */
export async function loadSettings(): Promise<ExtensionSettings> {
  const bag = await chrome.storage.local.get(STORAGE_SETTINGS_KEY);
  const raw = bag[STORAGE_SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...raw };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: settings });
}
