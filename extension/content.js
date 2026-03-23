// Memento Chrome Extension — Content Script

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "getPageData") {
    const selection = window.getSelection().toString();
    const title = document.title || "";
    const url = window.location.href || "";

    // Extract description from meta tag
    let description = "";
    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      document.querySelector('meta[property="og:description"]');
    if (metaDesc) {
      description = metaDesc.getAttribute("content") || "";
    }

    sendResponse({ selection, title, url, description });
  }

  // Return true to keep the message channel open for async response
  return true;
});
