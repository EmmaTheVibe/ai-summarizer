function extractPageContent() {
  const candidateSelectors = [
    "article",
    '[role="main"]',
    "main",
    ".post-content",
    ".article-content",
    ".entry-content",
    ".content",
    "#content",
    "#main",
  ];

  let contentEl = null;
  for (const selector of candidateSelectors) {
    const el = document.querySelector(selector);
    if (el && el.innerText.trim().length > 200) {
      contentEl = el;
      break;
    }
  }

  if (!contentEl) {
    contentEl = document.body;
  }

  const clone = contentEl.cloneNode(true);

  const noiseSelectors = [
    "nav",
    "header",
    "footer",
    "aside",
    ".nav",
    ".header",
    ".footer",
    ".sidebar",
    ".advertisement",
    ".ads",
    ".ad",
    ".comments",
    ".comment-section",
    ".social-share",
    ".share-buttons",
    "script",
    "style",
    "noscript",
    "iframe",
    "form",
  ];

  noiseSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  const rawText = clone.innerText || clone.textContent || "";
  const cleaned = rawText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 20)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    title: document.title,
    url: window.location.href,
    content: cleaned.slice(0, 15000),
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "EXTRACT_CONTENT") {
    try {
      const data = extractPageContent();
      sendResponse({ success: true, data });
    } catch (err) {
      sendResponse({ success: false, error: "Failed to extract page content" });
    }
  }
  return true;
});
