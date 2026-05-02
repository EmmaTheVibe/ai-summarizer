# AI Page Summarizer — Chrome Extension

A Chrome Extension (Manifest V3) that extracts content from any webpage and uses Google Gemini AI to generate a structured summary with bullet points, key insights, and estimated reading time.

**This extension works out of the box — no API key or account needed.**

---

## Download and Install

This extension is **not** on the Chrome Web Store. Install it locally in developer mode:

1. **Download the repo**

   ```bash
   git clone https://github.com/EmmaTheVibe/ai-summarizer
   cd ai-summarizer
   ```

2. **Open Chrome** and go to `chrome://extensions`

3. **Enable Developer Mode** — toggle in the top right corner

4. **Click "Load unpacked"**

5. **Select the `extension/` folder** from the downloaded repo

6. The **AI Summarizer** icon appears in your toolbar. Pin it for easy access

---

## How to Use

1. Navigate to any article or webpage
2. Click the extension icon in the toolbar
3. Click **Summarize Page**
4. Wait a few seconds while the AI processes the content
5. Read your summary. This will include bullet points, key insights, and estimated reading time
6. Click **Copy** to copy the summary to clipboard
7. Click **X** to clear and summarize another page

> Works best on article pages such as news, blogs, Wikipedia, and similar content-heavy pages.

---

## Architecture

```
┌─────────────┐     EXTRACT_CONTENT     ┌─────────────────┐
│  popup.js   │ ──────────────────────▶ │  content.js     │
│  (UI layer) │ ◀────────────────────── │  (page context) │
└─────────────┘     page text           └─────────────────┘
       │
       │ SUMMARIZE (text + url)
       ▼
┌─────────────────┐     POST /api/summarize    ┌──────────────────┐
│  background.js  │ ────────────────────────▶ │  Vercel Proxy    │
│  (service       │ ◀──────────────────────── │  (serverless fn) │
│   worker)       │     JSON summary           └──────────────────┘
└─────────────────┘                                    │
       │                                               ▼
  chrome.storage                              Gemini 2.5 Flash API
  (cache per URL)
```

### File Structure

```
ai-summarizer/
├── extension/
│   ├── manifest.json       # Manifest V3 config
│   ├── background.js       # Service worker — messaging + caching
│   ├── content.js          # Content extraction from page DOM
│   ├── popup/
│   │   ├── popup.html      # Extension popup UI
│   │   ├── popup.css       # Styles
│   │   └── popup.js        # UI logic and Chrome messaging
│   └── icons/              # Extension icons (16, 48, 128px)
└── proxy/
    ├── vercel.json
    └── api/
        └── summarize.js    # Serverless function — calls Gemini
```

---

## AI Integration

- **Model:** `gemini-2.5-flash`
- **Prompt:** Instructs Gemini to return structured JSON with `bullets` and `insights` arrays
- **Response parsing:** JSON is extracted and validated before rendering
- **Token limit:** Page content capped at 12,000 characters before sending to stay within model limits

---

## Security Decisions

| Decision                   | Reason                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| API key in Vercel env vars | Never committed to repo, never sent to browser                         |
| Proxy server architecture  | Extension never touches the API key directly                           |
| Input validation on proxy  | Prevents oversized payloads and invalid requests                       |
| XSS sanitization in popup  | All AI-generated text rendered via `textContent`, not `innerHTML`      |
| Message validation         | Background script validates message type and content before processing |
| Minimal permissions        | Only `activeTab`, `storage`, `scripting` included.                     |

---

## Trade-offs

- **Proxy dependency** — if the Vercel proxy is down, the extension won't work
- **Caching per URL** — summaries are cached for 1 hour; dynamic pages may show stale results
- **Content extraction** — heuristic-based; may miss content on heavily JavaScript-rendered pages
- **Best on articles** — works best on content-heavy pages; list/index pages may produce less useful summaries
- **Shared quota** — all users share the same Gemini free tier quota (1,500 req/day)
