// Server-only AI helper. Preference: Lovable AI first. Work is split:
// - "direction" (scene planning, the heavy job) always prefers Lovable AI.
// - "light" (captions, storyboards) goes to Gemini direct when GEMINI_API_KEY exists, saving Lovable credits.
// Either provider covers for the other when it fails (no credits, rate limit, outage). Returns null so callers use fallbacks.
export type AiTask = "direction" | "light";

const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const GEMINI_MODEL = "gemini-2.5-flash";

async function askLovable(prompt: string, model: string): Promise<string | null> {
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
    console.error("Lovable AI request failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function askGemini(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt + "\n\nResponda somente com JSON válido." }] }],
          generationConfig: { responseMimeType: "application/json" },
        }),
      },
    );
    if (!res.ok) {
      // Quota exhausted (429) pauses this provider for the request; never switches to paid billing.
      console.error(`Gemini direct [${res.status}]`);
      return null;
    }
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") || null;
  } catch (e) {
    console.error("Gemini direct request failed", e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function providerOrder(task: AiTask, hasGemini: boolean): ("lovable" | "gemini")[] {
  if (!hasGemini) return ["lovable"];
  return task === "light" ? ["gemini", "lovable"] : ["lovable", "gemini"];
}

export async function askAi(prompt: string, task: AiTask = "direction"): Promise<string | null> {
  for (const p of providerOrder(task, !!process.env.GEMINI_API_KEY)) {
    const out = p === "lovable" ? await askLovable(prompt, LOVABLE_MODEL) : await askGemini(prompt);
    if (out) {
      console.log(`AI provider used: ${p} (${task})`);
      return out;
    }
  }
  return null;
}

export function parseJson(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  } catch {
    return null;
  }
}
