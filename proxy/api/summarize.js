const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

const ALLOWED_ORIGIN = "*";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const { content, title } = req.body ?? {};

  if (!content || typeof content !== "string") {
    return res.status(400).json({ error: "Missing or invalid content" });
  }

  if (content.length > 20000) {
    return res.status(400).json({ error: "Content too long" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key not configured" });

  const prompt = `You are a helpful assistant that summarizes web pages.

Summarize the following webpage content. You MUST respond with ONLY a valid JSON object. No markdown, no code fences, no explanation, nothing else before or after the JSON.

Page title: ${title ?? "Unknown"}

Content:
${content.slice(0, 12000)}

Your response must be exactly this JSON structure:
{"bullets":["point 1","point 2","point 3","point 4","point 5"],"insights":["insight 1","insight 2","insight 3"]}

Rules:
- bullets: 4-5 bullet points, each under 20 words
- insights: 2-3 key insights, each under 25 words
- All strings must be plain text only, no markdown or special characters
- Be concise. Shorter is better
- Respond with ONLY the JSON object, nothing else`;

  try {
    const geminiRes = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      console.error("Gemini error:", err);
      return res
        .status(502)
        .json({ error: "AI service error. Please try again." });
    }

    const geminiData = await geminiRes.json();
    const rawText =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let parsed;
    try {
      parsed = JSON.parse(rawText.trim());
    } catch {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsed = JSON.parse(jsonMatch[0]);
        } catch {
          console.error("Failed to parse Gemini response:", rawText);
          return res
            .status(502)
            .json({ error: "Could not parse AI response. Please try again." });
        }
      } else {
        console.error("No JSON found in Gemini response:", rawText);
        return res
          .status(502)
          .json({ error: "Could not parse AI response. Try again." });
      }
    }

    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.slice(0, 6).map((b) => String(b))
      : ["No summary available."];

    const insights = Array.isArray(parsed.insights)
      ? parsed.insights.slice(0, 4).map((i) => String(i))
      : [];

    return res.status(200).json({ bullets, insights });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
