import { BUILTIN_OPENROUTER_KEY } from "../constants/builtinOpenRouter";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../types/storage";
import { STORAGE_SETTINGS_KEY } from "./keys";

/** Load merged settings from chrome.storage.local */
export async function loadSettings(): Promise<ExtensionSettings> {
  const bag = await chrome.storage.local.get(STORAGE_SETTINGS_KEY);
  const raw = bag[STORAGE_SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...raw };
  // Saved "" would override built-in OpenRouter key; treat empty as "use default key"
  if (!merged.openrouterApiKey?.trim()) {
    merged.openrouterApiKey = BUILTIN_OPENROUTER_KEY;
  }
  if (!merged.resumeProfile) {
    merged.resumeProfile = DEFAULT_SETTINGS.resumeProfile;
  }
  return merged;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: settings });
}
