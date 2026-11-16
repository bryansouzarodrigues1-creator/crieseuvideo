// Server-only: adaptador de IA de texto. Retorna null quando indisponível, para os chamadores usarem o plano B determinístico.
// Provedores (escolha explícita, sem troca silenciosa para um caminho que possa cobrar):
//  - padrão: Lovable AI Gateway (LOVABLE_API_KEY);
//  - AI_PROVIDER=gemini: Gemini direto (GEMINI_API_KEY; modelo em GEMINI_MODEL). Sem a chave, devolve null em vez de cair no gateway.
// Segredos ficam só no servidor e nunca são registrados em log.
export type AiProvider = "gemini" | "lovable";

export function activeProvider(): AiProvider | null {
  if (process.env.AI_PROVIDER === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : null;
  return process.env.LOVABLE_API_KEY ? "lovable" : null;
}

/** Modelo do Gemini direto. Confirme a disponibilidade na lista oficial antes de ativar (a lista muda). */
export const geminiModel = () => {
  const m = process.env.GEMINI_MODEL || "gemini-3.5-flash";
  return /^[a-z0-9][a-z0-9.\-]{2,60}$/.test(m) ? m : "gemini-3.5-flash";
};

async function post(url: string, headers: Record<string, string>, body: unknown, label: string): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { method: "POST", signal: ctrl.signal, headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) {
      console.error(`${label} [${res.status}]: ${(await res.text()).slice(0, 500)}`);
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error(`${label} request failed`, e instanceof Error ? e.message : "unknown");
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Gemini direto com saída JSON (e, opcionalmente, JSON Schema para a resposta sair no formato exato). */
async function gemini(prompt: string, schema?: object): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const mime = "APPLICATION_JSON";
  const generationConfig = process.env.GEMINI_SCHEMA_STYLE === "legacy"
    ? { responseMimeType: "application/json", ...(schema ? { responseJsonSchema: schema } : {}) }
    : { responseFormat: { text: { mimeType: mime, ...(schema ? { schema } : {}) } } };
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent`,
    { "x-goog-api-key": key },
    { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig },
    "Gemini",
  );
  const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  return text || null;
}

async function gateway(prompt: string, model: string): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) return null;
  const data = await post(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    { Authorization: `Bearer ${key}` },
    { model, messages: [{ role: "user", content: prompt + "\n\nResponda somente com JSON válido." }], response_format: { type: "json_object" } },
    "AI gateway",
  );
  return data?.choices?.[0]?.message?.content ?? null;
}

export async function askAi(prompt: string, model = "google/gemini-3-flash-preview"): Promise<string | null> {
  const p = activeProvider();
  if (p === "gemini") return gemini(prompt + "\n\nResponda somente com JSON válido.");
  if (p === "lovable") return gateway(prompt, model);
  return null;
}

/** Pedido com formato garantido: no Gemini direto usa o schema nativo; no gateway o schema vai junto do prompt. */
export async function askAiStructured(prompt: string, schema: object): Promise<{ data: unknown; provider: AiProvider } | null> {
  const p = activeProvider();
  if (!p) return null;
  const text = p === "gemini"
    ? await gemini(prompt, schema)
    : await gateway(`${prompt}\n\nFormato JSON exigido (JSON Schema):\n${JSON.stringify(schema)}`, "google/gemini-3-flash-preview");
  const data = parseJson(text);
  return data ? { data, provider: p } : null;
}

export function parseJson(text: string | null): any {
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
  } catch {
    return null;
  }
}
