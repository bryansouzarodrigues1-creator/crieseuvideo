// Server-only helper: calls the Lovable AI Gateway, returns null when unavailable so callers use fallbacks.
export async function askAi(prompt: string, model = "google/gemini-3-flash-preview"): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt + "\n\nResponda somente com JSON válido." }],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      console.error(`AI gateway [${res.status}]: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("AI request failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function parseJson(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  } catch {
    return null;
  }
}
