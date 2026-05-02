const PROXY_URL = "https://ai-summarizer-hng.vercel.app/api/summarize";

function estimateReadingTime(text) {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

async function getCachedSummary(url) {
  return new Promise((resolve) => {
    chrome.storage.local.get([url], (result) => resolve(result[url] ?? null));
  });
}

async function cacheSummary(url, summary) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      { [url]: { summary, cachedAt: Date.now() } },
      resolve,
    );
  });
}

function isCacheValid(cached) {
  if (!cached?.cachedAt) return false;
  return Date.now() - cached.cachedAt < 60 * 60 * 1000;
}

async function callProxy(content, title) {
  const response = await fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, title }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.error ?? `Request failed with status ${response.status}`,
    );
  }

  return response.json();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SUMMARIZE") return;

  const { content, title, url } = message;

  if (!content || typeof content !== "string") {
    sendResponse({ success: false, error: "No page content provided" });
    return true;
  }

  (async () => {
    try {
      const cached = await getCachedSummary(url);
      if (isCacheValid(cached)) {
        sendResponse({ success: true, data: cached.summary });
        return;
      }

      const result = await callProxy(content, title);
      const summary = {
        ...result,
        readingTime: estimateReadingTime(content),
        url,
        title,
      };

      await cacheSummary(url, summary);
      sendResponse({ success: true, data: summary });
    } catch (err) {
      console.error("[AI Summarizer] Error:", err.message);
      sendResponse({
        success: false,
        error: err.message ?? "Something went wrong",
      });
    }
  })();

  return true;
});
