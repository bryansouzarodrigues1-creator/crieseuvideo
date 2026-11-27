// Server-only AI helper. Preference: Lovable AI first. Work is split:
// - "direction" (scene planning, the heavy job) always prefers Lovable AI.
// - "light" (captions, storyboards) goes to Gemini direct when GEMINI_API_KEY exists, saving Lovable credits.
// Either provider covers for the other when it fails (no credits, rate limit, outage). Returns null so callers use fallbacks.
import {readGeminiErrorDiagnostic,formatGeminiCause} from './geminiFailure';
import type {GeminiErrorDiagnostic} from './geminiFailure';
export type AiTask = "direction" | "light";

/** Only safe, nonsecret provider diagnoses travel to the browser. */
export type ProviderProblem =
  | 'not_configured' | 'unauthorized' | 'quota' | 'forbidden'
  | 'service_unavailable' | 'timeout' | 'network'
  | 'empty_response' | 'invalid_response' | 'invalid_json' | 'invalid_scene'
  | 'truncated_response' | 'response_too_large'
  | 'invalid_request' | 'model_unavailable' | 'billing_required';
export type Ai3DProvider = 'lovable' | 'gemini';
export type ProviderFailure = { provider: Ai3DProvider; reason: ProviderProblem; diagnostic?:GeminiErrorDiagnostic };
const safeProblem = (status:number):ProviderProblem => {
  if(status===400||status===422) return 'invalid_request';
  if(status===404) return 'model_unavailable';
  if(status===402) return 'billing_required';
  if(status===408) return 'timeout';
  if(status===413) return 'response_too_large';
  if(status===401) return 'unauthorized';
  if(status===403) return 'forbidden';
  if(status===429) return 'quota';
  return status>=500 ? 'service_unavailable' : 'invalid_response';
};
const ptProblem:Record<ProviderProblem,string> = {
  invalid_request:'o provedor recusou a configuração da chamada (HTTP 400/422). Não é falha de roteiro nem erro de JSON da cena',
  model_unavailable:'modelo configurado indisponível (HTTP 404)',
  billing_required:'créditos ou faturamento indisponíveis (HTTP 402)',
  not_configured:'chave não configurada no servidor',
  unauthorized:'chave rejeitada (401)',
  quota:'cota ou limite de chamadas atingido (429)',
  forbidden:'acesso ao modelo não autorizado (403)',
  service_unavailable:'falha temporária do serviço do provedor (HTTP 5xx); tente mais tarde ou selecione manualmente outro modelo',
  timeout:'tempo de resposta esgotado',
  network:'falha de comunicação com o provedor',
  empty_response:'a IA respondeu sem conteúdo',
  invalid_response:'a resposta não corresponde ao formato 3D esperado',
  invalid_json:'a resposta não contém um JSON 3D legível',
  invalid_scene:'o JSON não respeitou as regras de objetos e movimentos do motor',
  truncated_response:'a resposta foi interrompida antes de terminar',
  response_too_large:'a IA retornou uma resposta grande demais'
};
export class Ai3DProviderError extends Error {
  readonly code = 'ai_3d_provider_failed';
  constructor(readonly failures:ProviderFailure[]){
    super('Não foi possível gerar a cena 3D. '+
      failures.map(x=>(x.provider==='lovable'?'IA do Lovable':'Gemini')+': '+ptProblem[x.reason]+(x.diagnostic?' (HTTP '+x.diagnostic.httpStatus+'. '+formatGeminiCause(x.diagnostic)+')':'')).join('; ')+
      '. Confira a configuração ou selecione outro provedor. Nenhum vídeo de demonstração foi usado.');
    this.name='Ai3DProviderError';
  }
}


// Configurable without redeploying code; the previous preview model can be retired.
const LOVABLE_MODEL = process.env.LOVABLE_AI_MODEL || "google/gemini-3.7-flash"; // Override via project env only
// New API projects can receive 404 for legacy Gemini 2.5 Flash even when
// models.get lists it. Prefer a current model; allow server-side override.
const GEMINI_MODEL = process.env.GEMINI_AI_MODEL || "gemini-3.6-flash";
 // Explicit user choices, never arbitrary provider paths or URLs.
 export type GeminiModelChoice = 'default'|'gemini-3.5-flash-lite'|'gemini-3.6-flash'|'gemini-3.8-flash';
 export const resolveGeminiModel=(choice:GeminiModelChoice='default'):string =>
   choice==='default'?GEMINI_MODEL:choice;

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
      console.error(`AI gateway failed with HTTP ${res.status} (model/configuration may be incompatible)`);
      onProblem?.(safeProblem(res.status));
      return null;
    }
    const data = await res.json();
    const first=data.choices?.[0];
    // OpenAI-compatible gateways may return content as text segments.
    const raw=first?.message?.content;
    const content=typeof raw==='string'?raw:
      Array.isArray(raw)?raw.filter((p:unknown):p is {text:string}=>
        !!p&&typeof p==='object'&&typeof (p as {text?:unknown}).text==='string')
        .map(p=>p.text).join(''):null;
    if(first?.finish_reason==='length'){
      onProblem?.('truncated_response');return null;
    }
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

async function askGemini(
  prompt: string, onProblem?: (reason: ProviderProblem, diagnostic?:GeminiErrorDiagnostic) => void,
  responseSchema?:Record<string,unknown>,
  modelChoice:GeminiModelChoice='default', forceHigh=false
): Promise<string | null> {
  const model = resolveGeminiModel(modelChoice);
  const key = process.env.GEMINI_API_KEY;
  if (!key){onProblem?.('not_configured');return null;}
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: ctrl.signal,
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt + "\n\nResponda somente com JSON válido." }] }],
          // Gemini 2.5 JSON mode without responseSchema is only a format
          // preference. The schema constrains field names, enum values,
          // IDs and geometry before the separate strict compiler checks.
          generationConfig: {
            responseMimeType: "application/json",
            ...(responseSchema?{responseSchema}:{}),
            ...((responseSchema||forceHigh)&&model==='gemini-3.6-flash'
              ?{thinkingConfig:{thinkingLevel:'high'},maxOutputTokens:8192}:{}),
          },
        }),
      },
    );
    if (!res.ok) {
      // Quota exhausted (429) pauses this provider for the request; never switches to paid billing.
      const diagnostic=await readGeminiErrorDiagnostic(res);
      // Do not log sensitive provider response, request or user text.
      console.error(`Gemini direct failed with HTTP ${res.status}, category ${diagnostic.cause}`);
      onProblem?.(safeProblem(res.status),diagnostic.cause==='unknown'?undefined:diagnostic);
      return null;
    }
    const data = await res.json();
    const candidate=data.candidates?.[0];
    if(candidate?.finishReason==='MAX_TOKENS'){
      onProblem?.('truncated_response');return null;
    }
    const content=candidate?.content?.parts
      ?.filter((p:unknown):p is {text:string}=>
        !!p&&typeof p==='object'&&!(p as {thought?:unknown}).thought&&typeof (p as {text?:unknown}).text==='string')
      .map((p:{text:string})=>p.text).join('') || null;
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
export type Ai3DValidation = boolean | {accepted:boolean; reason?:'invalid_json'|'invalid_scene'};
export async function ask3DWorldAi(
  prompt:string,
  preferred:'auto'|'gemini'|'lovable'='auto',
  isValid?:(content:string)=>Ai3DValidation,
  responseSchema?:Record<string,unknown>,
  geminiModel:GeminiModelChoice='default'
):Promise<{provider:'gemini'|'lovable';text:string}|null> {
  const order:Ai3DProvider[]=preferred==='auto'
    ? providerOrder('direction',!!process.env.GEMINI_API_KEY)
    : [preferred];
  const failures:ProviderFailure[]=[];
  for(const provider of order){
    let problem:ProviderProblem|undefined;
    let diagnostic:GeminiErrorDiagnostic|undefined;
    const mark=(reason:ProviderProblem,details?:GeminiErrorDiagnostic)=>{problem=reason;diagnostic=details;};
    const text=provider==='lovable'
      ?await askLovable(prompt,LOVABLE_MODEL,mark)
      :await askGemini(prompt,mark,responseSchema,geminiModel);
    if(text && text.length<=480000){
      // An HTTP 200 with broken scene geometry is not a successful 3D video.
      // In auto mode, allow one alternative provider, never an unbounded retry.
      let validation:Ai3DValidation=true;
      if(isValid){
        try{validation=isValid(text);}catch{validation={accepted:false,reason:'invalid_scene'};}
      }
      const accepted=typeof validation==='boolean'?validation:validation.accepted;
      if(accepted)return {provider,text};
      const reason=typeof validation==='boolean'
        ?'invalid_response'
        :validation.reason??'invalid_scene';
      // Never log a generated scene, prompt or key, even if it failed.
      console.warn('3D scene rejected by validator:',provider,reason);
      failures.push({provider,reason});
      continue;
    }
    failures.push({provider,reason:text && text.length>480000?'response_too_large':problem??'invalid_response',...(diagnostic?{diagnostic}:{})});
  }
  throw new Ai3DProviderError(failures);
}

/** Direct-only director: no paid fallback, no hidden retry. */
export async function askGeminiForEditorial(prompt:string) {
  let problem:ProviderProblem='invalid_response';
  const text=await askGemini(prompt,reason=>{problem=reason;},undefined,'gemini-3.6-flash',true);
  return {text,problem,model:'gemini-3.6-flash',thinkingLevel:'high' as const};
}
