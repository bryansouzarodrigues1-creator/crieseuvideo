// Server-only provider router. The optional environment also lets the private
// test deployment reuse this code without copying secrets into browser bundles.
export type AiEnvironment = Partial<Record<'AI_TEXT_PROVIDER' | 'AI_TEXT_FALLBACK' | 'GEMINI_API_KEY' | 'GEMINI_TEXT_MODEL' | 'LOVABLE_API_KEY', string>>;
export type AiProvider = 'gemini' | 'lovable';
export type AiFailure = 'missing_key' | 'quota' | 'auth' | 'timeout' | 'invalid_response' | 'upstream' | 'configuration' | 'invalid_request' | 'unsupported_model' | 'blocked' | 'truncated';
export type AiResult =
  | { ok: true; text: string; provider: AiProvider; model: string }
  | { ok: false; code: AiFailure; status: number; provider: AiProvider; model: string };
export interface AiOutputOptions { schema?: Record<string, unknown> }

const ALLOWED_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'] as const;
const runtimeEnv = (): AiEnvironment => typeof process === 'undefined' ? {} : process.env;

async function requestText(prompt: string, provider: AiProvider, model: string, env: AiEnvironment, options?: AiOutputOptions): Promise<AiResult> {
  const key = provider === 'gemini' ? env.GEMINI_API_KEY : env.LOVABLE_API_KEY;
  const failure = (code: AiFailure, status = 503): AiResult => {
    console.warn('AI_FAILURE', JSON.stringify({ provider, model, code, status }));
    return { ok: false, code, status, provider, model };
  };
  if (!key) return failure('missing_key');
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 60000);
  try {
    const direct = provider === 'gemini';
    const res = await fetch(direct
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      : 'https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: direct
        ? { 'x-goog-api-key': key, 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(direct ? {
        contents: [{ role: 'user', parts: [{ text: prompt + '\n\nResponda somente com JSON válido.' }] }],
        generationConfig: { maxOutputTokens: 8192, ...(options?.schema
          ? { responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: options.schema } } }
          : { responseMimeType: 'application/json' }) },
      } : {
        model, messages: [{ role: 'user', content: prompt + '\n\nResponda somente com JSON válido.' }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      // Read only a whitelisted reason; never log the provider message or headers.
      const body=await Promise.resolve().then(() => res.json()).catch(()=>null);
      const reasons=Array.isArray(body?.error?.details)?body.error.details.map((item:any)=>item?.reason):[];
      if(reasons.some((reason:unknown)=>['API_KEY_INVALID','API_KEY_SERVICE_BLOCKED','API_KEY_HTTP_REFERRER_BLOCKED','API_KEY_IP_ADDRESS_BLOCKED'].includes(String(reason))))return failure('auth',res.status);
      return failure(res.status === 402 || res.status === 429 ? 'quota' : res.status === 401 || res.status === 403 ? 'auth' : res.status === 400 ? 'invalid_request' : res.status === 404 ? 'unsupported_model' : 'upstream', res.status);
    }
    const data = await res.json();
    const candidate = data?.candidates?.[0];
    if (direct && data?.promptFeedback?.blockReason) return failure('blocked', 422);
    if (direct && candidate?.finishReason && candidate.finishReason !== 'STOP') return failure(candidate.finishReason === 'MAX_TOKENS' ? 'truncated' : candidate.finishReason === 'SAFETY' ? 'blocked' : 'invalid_response', 502);
    const text = direct
      ? candidate?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text ?? '').join('')
      : data?.choices?.[0]?.message?.content;
    return typeof text === 'string' && text.trim() ? { ok: true, text, provider, model } : failure('invalid_response', 502);
  } catch {
    return failure(ctrl.signal.aborted ? 'timeout' : 'upstream');
  } finally { clearTimeout(timeout); }
}

/** Detailed failures are used by the director to pause instead of silently replacing AI scenes. */
export async function askAiResult(prompt: string, model = 'google/gemini-3-flash-preview', env: AiEnvironment = runtimeEnv(), options?: AiOutputOptions): Promise<AiResult> {
  const configured = env.GEMINI_TEXT_MODEL;
  const geminiModel = configured && (ALLOWED_GEMINI_MODELS as readonly string[]).includes(configured) ? configured : ALLOWED_GEMINI_MODELS[0];
  if (env.AI_TEXT_PROVIDER && !['gemini', 'lovable'].includes(env.AI_TEXT_PROVIDER)) {
    return { ok: false, provider: 'lovable', model, status: 503, code: 'configuration' };
  }
  if (env.AI_TEXT_PROVIDER === 'gemini') return requestText(prompt, 'gemini', geminiModel, env, options);
  const result = await requestText(prompt, 'lovable', model, env, options);
  if (!result.ok && (result.status === 402 || result.status === 429) && env.AI_TEXT_FALLBACK === 'gemini') {
    return requestText(prompt, 'gemini', geminiModel, env, options);
  }
  return result;
}

/** Legacy endpoints keep their existing nullable contract. */
export async function askAi(prompt: string, model = 'google/gemini-3-flash-preview'): Promise<string | null> {
  const result = await askAiResult(prompt, model);
  return result.ok ? result.text : null;
}

export function parseJson(text: string | null): any {
  if (!text) return null;
  try { return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim()); }
  catch { return null; }
}
