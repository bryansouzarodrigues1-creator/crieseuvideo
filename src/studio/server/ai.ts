// Server-only AI helper. Preference: Lovable AI first. Work is split:
// - "direction" (scene planning, the heavy job) always prefers Lovable AI.
// - "light" (captions, storyboards) goes to Gemini direct when GEMINI_API_KEY exists, saving Lovable credits.
// Either provider covers for the other when it fails (no credits, rate limit, outage). Returns null so callers use fallbacks.
export type AiTask = "direction" | "light";

/** Only safe, nonsecret provider diagnoses travel to the browser. */
export type ProviderProblem =
  | 'not_configured' | 'unauthorized' | 'quota' | 'forbidden'
  | 'service_unavailable' | 'timeout' | 'network'
  | 'empty_response' | 'invalid_response' | 'response_too_large';
export type Ai3DProvider = 'lovable' | 'gemini';
export type ProviderFailure = { provider: Ai3DProvider; reason: ProviderProblem };
const safeProblem = (status:number):ProviderProblem => {
  if(status===401) return 'unauthorized';
  if(status===403) return 'forbidden';
  if(status===429) return 'quota';
  return status>=500 ? 'service_unavailable' : 'invalid_response';
};
const ptProblem:Record<ProviderProblem,string> = {
  not_configured:'chave não configurada no servidor',
  unauthorized:'chave rejeitada (401)',
  quota:'cota ou limite de chamadas atingido (429)',
  forbidden:'acesso ao modelo não autorizado (403)',
  service_unavailable:'serviço indisponível (5xx)',
  timeout:'tempo de resposta esgotado',
  network:'falha de comunicação com o provedor',
  empty_response:'a IA respondeu sem conteúdo',
  invalid_response:'a IA retornou um formato inesperado',
  response_too_large:'a IA retornou uma resposta grande demais'
};
export class Ai3DProviderError extends Error {
  readonly code = 'ai_3d_provider_failed';
  constructor(readonly failures:ProviderFailure[]){
    super('Não foi possível gerar a cena 3D. '+
      failures.map(x=>(x.provider==='lovable'?'IA do Lovable':'Gemini')+': '+ptProblem[x.reason]).join('; ')+
      '. Confira a configuração ou selecione outro provedor. Nenhum vídeo de demonstração foi usado.');
    this.name='Ai3DProviderError';
  }
}


const LOVABLE_MODEL = "google/gemini-3-flash-preview";
const GEMINI_MODEL = "gemini-2.5-flash";

async function askLovable(prompt: string, model: string, onProblem?: (reason: ProviderProblem) => void): Promise<string | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) { onProblem?.('not_configured'); return null; }
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
      // Do not log provider response bodies (may contain private user input).
      console.error(`AI gateway failed with HTTP ${res.status}`);
      onProblem?.(safeProblem(res.status));
      return null;
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if(typeof content!=='string' || !content.trim()) onProblem?.('empty_response');
    return typeof content==='string' && content.trim() ? content : null;
  } catch (e) {
    const timedOut = e instanceof Error && e.name==='AbortError';
    console.error("Lovable AI request failed:", timedOut ? 'timeout' : 'network');
    onProblem?.(timedOut?'timeout':'network');
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function askGemini(prompt: string, onProblem?: (reason: ProviderProblem) => void): Promise<string | null> {
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
      console.error(`Gemini direct failed with HTTP ${res.status}`);
      onProblem?.(safeProblem(res.status));
      return null;
    }
    const data = await res.json();
    const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? "").join("") || null;
    if(!content) onProblem?.('empty_response');
    return content;
  } catch (e) {
    const timedOut = e instanceof Error && e.name==='AbortError';
    console.error("Gemini direct request failed:", timedOut ? 'timeout' : 'network');
    onProblem?.(timedOut?'timeout':'network');
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


/** Explicitly user-initiated complex-world planning. The user's provider choice
 * is honored; "auto" uses Lovable direction first, Gemini as fallback.
 * This is an LLM planning call (credits may apply), not generative video.
 */
export async function ask3DWorldAi(
  prompt:string,
  preferred:'auto'|'gemini'|'lovable'='auto'
):Promise<{provider:'gemini'|'lovable';text:string}|null> {
  const order:Ai3DProvider[]=preferred==='auto'
    ? providerOrder('direction',!!process.env.GEMINI_API_KEY)
    : [preferred];
  const failures:ProviderFailure[]=[];
  for(const provider of order){
    let problem:ProviderProblem|undefined;
    const mark=(reason:ProviderProblem)=>{problem=reason;};
    const text=provider==='lovable'
      ?await askLovable(prompt,LOVABLE_MODEL,mark)
      :await askGemini(prompt,mark);
    if(text && text.length<=480000) return {provider,text};
    failures.push({provider,reason:text && text.length>480000?'response_too_large':problem??'invalid_response'});
  }
  throw new Ai3DProviderError(failures);
}
