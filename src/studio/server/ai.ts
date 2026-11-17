// Server-only AI text router. Credentials are never passed to the browser or committed to Git.
// Configuration:
//   AI_TEXT_PROVIDER=lovable (default) or gemini (direct Google API)
//   GEMINI_API_KEY=... (server secret, required when provider=gemini)
//   AI_TEXT_FALLBACK=gemini (optional: use direct Gemini only after Lovable returns 402 or 429)
//   GEMINI_TEXT_MODEL=gemini-3.6-flash (default) or gemini-3.5-flash-lite
// This module never automatically switches to a paid provider after a Gemini quota error.

const ALLOWED_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'] as const;
type GatewayResult = { text: string | null; status?: number };

function geminiModel(): string {
  const configured = process.env.GEMINI_TEXT_MODEL;
  return configured && (ALLOWED_GEMINI_MODELS as readonly string[]).includes(configured)
    ? configured : 'gemini-3.6-flash';
}

async function askGeminiDirect(prompt: string): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('[AI] GEMINI_API_KEY absent: direct Gemini request not sent.');
    return null;
  }

  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
      {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt + '\\n\\nResponda somente com JSON válido.' }] }],
          generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 },
        }),
      },
    );

    if (!res.ok) {
      // Do not print response bodies or credentials (provider errors can include sensitive details).
      console.warn(`[AI] Gemini direct request failed with HTTP ${res.status}.`);
      return null;
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('');
    return typeof text === 'string' && text.trim() ? text : null;
  } catch {
    console.warn('[AI] Gemini direct request failed or timed out.');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function askLovableGateway(prompt: string, model: string): Promise<GatewayResult> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return { text: null };
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt + '\\n\\nResponda somente com JSON válido.' }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      console.warn(`[AI] Lovable gateway failed with HTTP ${res.status}.`);
      return { text: null, status: res.status };
    }
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content ?? null };
  } catch {
    console.warn('[AI] Lovable gateway request failed or timed out.');
    return { text: null };
  } finally {
    clearTimeout(timeout);
  }
}

/** Existing route signature is retained for all directors and storyboard endpoints. */
export async function askAi(prompt: string, model = 'google/gemini-3-flash-preview'): Promise<string | null> {
  if (process.env.AI_TEXT_PROVIDER === 'gemini') {
    // Strictly no Lovable calls, even if the key is missing or Gemini hits its quota.
    return askGeminiDirect(prompt);
  }

  const result = await askLovableGateway(prompt, model);
  if (result.text) return result.text;

  // Opt-in fallback only. Never send a paid fallback request after Gemini failure.
  if ((result.status === 402 || result.status === 429) &&
      process.env.AI_TEXT_FALLBACK === 'gemini') {
    return askGeminiDirect(prompt);
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
