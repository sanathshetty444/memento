// Memento Chrome Extension — Popup Logic

const DEFAULT_API_URL = "http://127.0.0.1:21476";

// ── DOM refs ────────────────────────────────────────────────────
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const savePageBtn = document.getElementById("savePageBtn");
const saveSelectionBtn = document.getElementById("saveSelectionBtn");
const tagsInput = document.getElementById("tagsInput");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const recentMemories = document.getElementById("recentMemories");
const toast = document.getElementById("toast");

let apiUrl = DEFAULT_API_URL;
let isConnected = false;

// ── Helpers ─────────────────────────────────────────────────────

async function getApiUrl() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["mementoApiUrl"], (result) => {
      resolve(result.mementoApiUrl || DEFAULT_API_URL);
    });
  });
}

function parseTags() {
  const raw = tagsInput.value.trim();
  if (!raw) return ["chrome-extension"];
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .concat("chrome-extension");
}

function showToast(message, type = "success") {
  toast.textContent = message;
  toast.className = "toast " + type + " visible";
  setTimeout(() => {
    toast.classList.remove("visible");
  }, 2500);
}

function truncate(str, len = 120) {
  if (!str) return "";
  return str.length > len ? str.slice(0, len) + "..." : str;
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return Math.floor(diff / 60000) + "m ago";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "h ago";
  return d.toLocaleDateString();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ── API calls ───────────────────────────────────────────────────

async function apiRequest(method, path, body) {
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(apiUrl + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Request failed");
  }
  return res.json();
}

async function checkHealth() {
  try {
    const data = await apiRequest("GET", "/api/health");
    isConnected = true;
    statusDot.classList.add("connected");
    statusText.textContent = data.entries + " memories";
    savePageBtn.disabled = false;
    saveSelectionBtn.disabled = false;
    return true;
  } catch {
    isConnected = false;
    statusDot.classList.remove("connected");
    statusText.textContent = "Disconnected";
    savePageBtn.disabled = true;
    saveSelectionBtn.disabled = true;
    return false;
  }
}

async function loadRecentMemories() {
  try {
    const data = await apiRequest("GET", "/api/list?limit=5");
    if (!data.entries || data.entries.length === 0) {
      recentMemories.innerHTML = '<div class="empty-state">No memories yet</div>';
      return;
    }
    recentMemories.innerHTML = data.entries
      .map(
        (e) => `
      <div class="memory-item">
        <div class="content-preview">${escapeHtml(truncate(e.summary))}</div>
        <div class="meta">${formatTime(e.timestamp)}</div>
        ${
          e.tags && e.tags.length
            ? '<div class="tags">' +
              e.tags.map((t) => '<span class="tag">' + escapeHtml(t) + "</span>").join("") +
              "</div>"
            : ""
        }
      </div>`,
      )
      .join("");
  } catch {
    recentMemories.innerHTML = '<div class="empty-state">Could not load memories</div>';
  }
}

async function searchMemories(query) {
  if (!query.trim()) {
    searchResults.innerHTML = "";
    return;
  }
  try {
    const data = await apiRequest("POST", "/api/recall", {
      query,
      limit: 5,
    });
    if (!data.results || data.results.length === 0) {
      searchResults.innerHTML = '<div class="empty-state">No results</div>';
      return;
    }
    searchResults.innerHTML = data.results
      .map(
        (r) => `
      <div class="result-item">
        <span class="score">${(r.score * 100).toFixed(0)}%</span>
        <div class="content-preview">${escapeHtml(truncate(r.content))}</div>
        ${
          r.tags && r.tags.length
            ? '<div class="tags">' +
              r.tags.map((t) => '<span class="tag">' + escapeHtml(t) + "</span>").join("") +
              "</div>"
            : ""
        }
      </div>`,
      )
      .join("");
  } catch {
    searchResults.innerHTML = '<div class="empty-state">Search failed</div>';
  }
}

// ── Get selection from content script ───────────────────────────

function getSelectionFromTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) {
        resolve({ selection: "", title: "", url: "", description: "" });
        return;
      }
      chrome.tabs.sendMessage(tabs[0].id, { action: "getPageData" }, (response) => {
        if (chrome.runtime.lastError || !response) {
          // Fallback: use tab info only
          resolve({
            selection: "",
            title: tabs[0].title || "",
            url: tabs[0].url || "",
            description: "",
          });
          return;
        }
        resolve(response);
      });
    });
  });
}

// ── Save handlers ───────────────────────────────────────────────

async function savePage() {
  if (!isConnected) return;
  savePageBtn.disabled = true;

  try {
    const pageData = await getSelectionFromTab();
    const parts = [];
    if (pageData.title) parts.push("Title: " + pageData.title);
    if (pageData.url) parts.push("URL: " + pageData.url);
    if (pageData.description) parts.push("Description: " + pageData.description);
    if (pageData.selection) parts.push("Selected text: " + pageData.selection);

    const content = parts.join("\n");
    if (!content) {
      showToast("No page data to save", "error");
      savePageBtn.disabled = false;
      return;
    }

    const tags = parseTags();
    await apiRequest("POST", "/api/save", { content, tags });
    showToast("Page saved!");
    loadRecentMemories();
    checkHealth();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    savePageBtn.disabled = false;
  }
}

async function saveSelection() {
  if (!isConnected) return;
  saveSelectionBtn.disabled = true;

  try {
    const pageData = await getSelectionFromTab();
    if (!pageData.selection) {
      showToast("No text selected", "error");
      saveSelectionBtn.disabled = false;
      return;
    }

    const parts = [pageData.selection];
    if (pageData.url) parts.push("\nSource: " + pageData.url);

    const content = parts.join("");
    const tags = parseTags();
    await apiRequest("POST", "/api/save", { content, tags });
    showToast("Selection saved!");
    loadRecentMemories();
    checkHealth();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    saveSelectionBtn.disabled = false;
  }
}

// ── Debounced search ────────────────────────────────────────────

let searchTimeout = null;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchMemories(searchInput.value);
  }, 300);
});

// ── Button listeners ────────────────────────────────────────────

savePageBtn.addEventListener("click", savePage);
saveSelectionBtn.addEventListener("click", saveSelection);

// ── Init ────────────────────────────────────────────────────────

(async () => {
  apiUrl = await getApiUrl();
  const ok = await checkHealth();
  if (ok) {
    loadRecentMemories();
  }
})();
