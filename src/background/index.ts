/**
 * Service worker — minimal bootstrap. Popup talks to content scripts directly via tabs.sendMessage.
 * Extend here for alarms, context menus, or a future proxy message hub.
 */
chrome.runtime.onInstalled.addListener(() => {
  // Placeholder for future migrations or badge state
});
