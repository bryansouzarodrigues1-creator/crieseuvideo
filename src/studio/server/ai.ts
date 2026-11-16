// Server-only provider router. The optional environment also lets the private
// test deployment reuse this code without copying secrets into browser bundles.
export type AiEnvironment = Partial<Record<'AI_TEXT_PROVIDER' | 'AI_TEXT_FALLBACK' | 'GEMINI_API_KEY' | 'GEMINI_TEXT_MODEL' | 'LOVABLE_API_KEY' | 'FREEFORM_3D_GEMINI_API_KEY' | 'GEMINI_MAX_OUTPUT_TOKENS' | 'GEMINI_THINKING_LEVEL', string>>;
export type AiProvider = 'gemini' | 'lovable';
export type AiFailure = 'missing_key' | 'quota' | 'auth' | 'timeout' | 'invalid_response' | 'upstream' | 'configuration' | 'invalid_request' | 'unsupported_model' | 'blocked' | 'truncated';
export type AiResult =
  | { ok: true; text: string; provider: AiProvider; model: string }
  | { ok: false; code: AiFailure; status: number; provider: AiProvider; model: string };

const ALLOWED_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'] as const;
const runtimeEnv = (): AiEnvironment => typeof process === 'undefined' ? {} : process.env;
export function geminiModel(env: AiEnvironment) {
  return env.GEMINI_TEXT_MODEL && (ALLOWED_GEMINI_MODELS as readonly string[]).includes(env.GEMINI_TEXT_MODEL)
    ? env.GEMINI_TEXT_MODEL : ALLOWED_GEMINI_MODELS[0];
}
/** Stable GenerateContent wire format previously accepted by the connected model.
 * Renderer/source validation stays server-side; no experimental schema fields. */
export function geminiRequestBody(prompt: string, options: {
  maxOutputTokens?: number;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
} = {}) {
  return { contents: [{ role: 'user', parts: [{ text: prompt + '\n\nResponda somente com JSON válido.' }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      maxOutputTokens: options.maxOutputTokens ?? 8192,
      ...(options.thinkingLevel ? { thinkingConfig: { thinkingLevel: options.thinkingLevel } } : {}),
    } };
}
function failureCode(status: number, body: any): AiFailure {
  const reasons = Array.isArray(body?.error?.details) ? body.error.details.map((item: any) => item?.reason) : [];
  if (reasons.some((reason: unknown) => ['API_KEY_INVALID', 'API_KEY_SERVICE_BLOCKED', 'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED'].includes(String(reason)))) return 'auth';
  return status === 402 || status === 429 ? 'quota' : status === 401 || status === 403 ? 'auth' : status === 400 ? 'invalid_request' : status === 404 ? 'unsupported_model' : 'upstream';
}

/** countTokens performs no inference. This is a real, non-generating connection
 * preflight using the same request builder, not a guarantee of scene direction. */
export async function preflightGemini(env: AiEnvironment): Promise<{ ok: true; model: string; totalTokens: number } | { ok: false; code: AiFailure; status: number }> {
  if (!env.GEMINI_API_KEY) return { ok: false, code: 'missing_key', status: 503 };
  const model = geminiModel(env);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:countTokens`, {
      method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ generateContentRequest: { model: `models/${model}`, ...geminiRequestBody('Verificar a conexão do diretor de animação.') } }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) return { ok: false, code: failureCode(response.status, data), status: response.status };
    if (!Number.isInteger(data?.totalTokens) || data.totalTokens < 1) return { ok: false, code: 'invalid_response', status: 502 };
    return { ok: true, model, totalTokens: data.totalTokens };
  } catch { return { ok: false, code: 'upstream', status: 503 }; }
}

async function requestText(prompt: string, provider: AiProvider, model: string, env: AiEnvironment): Promise<AiResult> {
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
    // These settings apply ONLY when explicitly supplied by a server-side
    // caller. The legacy Gemini and Lovable routes retain previous defaults.
    // Gemini output quotas include thinking tokens, so smaller jobs can use
    // low thinking and a bounded extra output allowance rather than truncating.
    const configuredCap = Number(env.GEMINI_MAX_OUTPUT_TOKENS || '8192');
    const maxOutputTokens = Number.isFinite(configuredCap)
      ? Math.min(16384, Math.max(1024, Math.floor(configuredCap))) : 8192;
    const level = env.GEMINI_THINKING_LEVEL;
    const thinkingLevel = level && ['minimal', 'low', 'medium', 'high'].includes(level)
      ? level as 'minimal' | 'low' | 'medium' | 'high' : undefined;
    const res = await fetch(direct
      ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
      : 'https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: direct
        ? { 'x-goog-api-key': key, 'Content-Type': 'application/json' }
        : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(direct ? geminiRequestBody(prompt, { maxOutputTokens, thinkingLevel }) : {
        model, messages: [{ role: 'user', content: prompt + '\n\nResponda somente com JSON válido.' }],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      // Read only a whitelisted reason; never log the provider message or headers.
      const body=await Promise.resolve().then(() => res.json()).catch(()=>null);
      return failure(failureCode(res.status, body), res.status);
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
export async function askAiResult(prompt: string, model = 'google/gemini-3-flash-preview', env: AiEnvironment = runtimeEnv()): Promise<AiResult> {
  const selected = geminiModel(env);
  if (env.AI_TEXT_PROVIDER && !['gemini', 'lovable'].includes(env.AI_TEXT_PROVIDER)) {
    return { ok: false, provider: 'lovable', model, status: 503, code: 'configuration' };
  }
  if (env.AI_TEXT_PROVIDER === 'gemini') return requestText(prompt, 'gemini', selected, env);
  const result = await requestText(prompt, 'lovable', model, env);
  if (!result.ok && (result.status === 402 || result.status === 429) && env.AI_TEXT_FALLBACK === 'gemini') {
    return requestText(prompt, 'gemini', selected, env);
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
