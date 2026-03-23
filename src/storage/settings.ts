import { BUILTIN_OPENROUTER_KEY } from "../constants/builtinOpenRouter";
import { DEFAULT_SETTINGS, type ExtensionSettings } from "../types/storage";
import { STORAGE_SETTINGS_KEY } from "./keys";

/** Load merged settings from chrome.storage.local */
export async function loadSettings(): Promise<ExtensionSettings> {
  const bag = await chrome.storage.local.get(STORAGE_SETTINGS_KEY);
  const raw = bag[STORAGE_SETTINGS_KEY] as Partial<ExtensionSettings> | undefined;
  const merged: ExtensionSettings = { ...DEFAULT_SETTINGS, ...raw };
  if (!merged.resumeProfile) {
    merged.resumeProfile = DEFAULT_SETTINGS.resumeProfile;
  }
  // Older defaults: specific :free Qwen endpoints are often removed; use OpenRouter’s free router
  const migrateToFreeRouter = [
    "qwen/qwen2.5-7b-instruct:free",
    "qwen/qwen-2.5-7b-instruct:free",
  ];
  if (migrateToFreeRouter.includes(merged.openrouterModel)) {
    merged.openrouterModel = "openrouter/free";
    await chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: merged });
  }
  // Optional dev-only fallback from constants (usually empty)
  if (!merged.openrouterApiKey?.trim() && BUILTIN_OPENROUTER_KEY.trim()) {
    merged.openrouterApiKey = BUILTIN_OPENROUTER_KEY;
  }
  return merged;
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_SETTINGS_KEY]: settings });
}
