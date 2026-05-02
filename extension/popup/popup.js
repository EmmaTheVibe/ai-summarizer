const $ = (id) => document.getElementById(id);

const els = {
  pageTitle: $("pageTitle"),
  summarizeBtn: $("summarizeBtn"),
  clearBtn: $("clearBtn"),
  retryBtn: $("retryBtn"),
  copyBtn: $("copyBtn"),
  idleState: $("idleState"),
  loadingState: $("loadingState"),
  errorState: $("errorState"),
  summaryState: $("summaryState"),
  errorText: $("errorText"),
  bulletList: $("bulletList"),
  insightList: $("insightList"),
  readingTime: $("readingTime"),
  wordCount: $("wordCount"),
};

function showState(name) {
  ["idle", "loading", "error", "summary"].forEach((s) => {
    els[`${s}State`].hidden = s !== name;
  });
  els.clearBtn.hidden = name !== "summary";
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function renderSummary(data, wordCountVal) {
  els.readingTime.textContent = `⏱ ${data.readingTime}`;
  els.wordCount.textContent = `📄 ${wordCountVal.toLocaleString()} words`;

  els.bulletList.innerHTML = "";
  (data.bullets ?? []).forEach((point) => {
    const li = document.createElement("li");
    li.textContent = point;
    els.bulletList.appendChild(li);
  });

  els.insightList.innerHTML = "";
  (data.insights ?? []).forEach((insight) => {
    const li = document.createElement("li");
    li.textContent = insight;
    els.insightList.appendChild(li);
  });

  showState("summary");
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractContent(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CONTENT" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Could not connect to page. Try refreshing."));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error ?? "Failed to extract content"));
        return;
      }
      resolve(response.data);
    });
  });
}

async function summarize(content, title, url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: "SUMMARIZE", content, title, url },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error("Background service error. Try again."));
          return;
        }
        if (!response?.success) {
          reject(new Error(response?.error ?? "Summarization failed"));
          return;
        }
        resolve(response.data);
      },
    );
  });
}

async function handleSummarize() {
  showState("loading");

  try {
    const tab = await getCurrentTab();

    if (
      !tab?.url ||
      tab.url.startsWith("chrome://") ||
      tab.url.startsWith("chrome-extension://")
    ) {
      throw new Error("Cannot summarize this page. Try a regular webpage.");
    }

    const { content, title, url } = await extractContent(tab.id);

    if (!content || content.length < 100) {
      throw new Error("Not enough content found on this page.");
    }

    const wordCountVal = countWords(content);
    const summary = await summarize(content, title, url);
    renderSummary(summary, wordCountVal);
  } catch (err) {
    els.errorText.textContent = err.message ?? "Something went wrong.";
    showState("error");
  }
}

async function handleCopy() {
  const bullets = [...els.bulletList.querySelectorAll("li")]
    .map((li) => `• ${li.textContent}`)
    .join("\n");
  const insights = [...els.insightList.querySelectorAll("li")]
    .map((li) => `→ ${li.textContent}`)
    .join("\n");
  const text = `Summary\n${bullets}\n\nKey Insights\n${insights}`;

  try {
    await navigator.clipboard.writeText(text);
    els.copyBtn.textContent = "Copied!";
    setTimeout(() => {
      els.copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1 9V2a1 1 0 011-1h7" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg> Copy`;
    }, 2000);
  } catch {
    //
  }
}

function handleClear() {
  els.bulletList.innerHTML = "";
  els.insightList.innerHTML = "";
  showState("idle");
}

async function init() {
  const tab = await getCurrentTab();
  if (tab?.title) els.pageTitle.textContent = tab.title;

  els.summarizeBtn.addEventListener("click", handleSummarize);
  els.retryBtn.addEventListener("click", handleSummarize);
  els.clearBtn.addEventListener("click", handleClear);
  els.copyBtn.addEventListener("click", handleCopy);
}

init();
