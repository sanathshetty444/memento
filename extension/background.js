// Memento Chrome Extension — Background Service Worker

const DEFAULT_API_URL = "http://127.0.0.1:21476";

// ── Context menu setup ──────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-memento",
    title: "Save to Memento",
    contexts: ["selection"],
  });
});

// ── Context menu handler ────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-memento") return;

  const selectedText = info.selectionText;
  if (!selectedText) return;

  const apiUrl = await getApiUrl();
  const parts = [selectedText];
  if (info.pageUrl) parts.push("\nSource: " + info.pageUrl);

  const content = parts.join("");

  try {
    const res = await fetch(apiUrl + "/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        tags: ["chrome-extension", "context-menu"],
      }),
    });

    if (!res.ok) {
      throw new Error("Save failed: " + res.statusText);
    }

    // Show a badge briefly to confirm save
    chrome.action.setBadgeText({ text: "OK", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#4ecca3", tabId: tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId: tab.id });
    }, 2000);
  } catch (err) {
    chrome.action.setBadgeText({ text: "!", tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: "#e94560", tabId: tab.id });
    setTimeout(() => {
      chrome.action.setBadgeText({ text: "", tabId: tab.id });
    }, 2000);
    console.error("Memento save error:", err);
  }
});

// ── Helpers ─────────────────────────────────────────────────────

function getApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["mementoApiUrl"], (result) => {
      resolve(result.mementoApiUrl || DEFAULT_API_URL);
    });
  });
}
