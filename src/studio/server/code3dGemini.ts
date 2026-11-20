// Server-only: one Gemini call that returns a Three.js program (EXPERIMENTAL).
// No fallback provider, no retries, no repair calls. Keys stay on the server
// and are never logged; provider response bodies are never logged or returned.
import { code3dPrompt, extractCode, type Code3DAspect } from '../code3d/contract';

export type Code3DFailure =
  | 'not_configured' | 'unauthorized' | 'forbidden' | 'quota' | 'model_unavailable'
  | 'invalid_request' | 'billing_required' | 'service_unavailable' | 'timeout' | 'network'
  | 'empty_response' | 'truncated_response' | 'blocked' | 'no_code' | 'too_large'
  | 'syntax_error' | 'contract_error' | 'invalid_response';

export const code3dFailureText: Record<Code3DFailure, string> = {
  not_configured: 'GEMINI_API_KEY não está configurada no servidor. Nenhuma chamada foi feita.',
  unauthorized: 'o Gemini rejeitou a chave configurada (HTTP 401).',
  forbidden: 'o Gemini negou acesso a este modelo (HTTP 403).',
  quota: 'cota ou limite de chamadas do Gemini atingido (HTTP 429).',
  model_unavailable: 'o modelo configurado não existe ou não está disponível (HTTP 404).',
  invalid_request: 'o Gemini recusou a configuração da chamada (HTTP 400).',
  billing_required: 'faturamento do Gemini indisponível (HTTP 402).',
  service_unavailable: 'serviço do Gemini indisponível (5xx).',
  timeout: 'o Gemini demorou demais para responder.',
  network: 'falha de comunicação com o Gemini.',
  empty_response: 'o Gemini respondeu sem conteúdo.',
  invalid_response: 'o Gemini retornou uma resposta que não pode ser lida.',
  truncated_response: 'a resposta do Gemini foi cortada antes de terminar o código.',
  blocked: 'o Gemini bloqueou a resposta por política de segurança.',
  no_code: 'a resposta não contém uma função createScene.',
  too_large: 'o código gerado excede o limite de tamanho.',
  syntax_error: 'o código gerado tem erro de sintaxe',
  contract_error: 'o código gerado não segue o contrato',
};

export const code3dModel = () =>
  process.env.GEMINI_CODE3D_MODEL || process.env.GEMINI_AI_MODEL || 'gemini-3.8-flash';

const statusFailure = (s: number): Code3DFailure =>
  s === 400 || s === 422 ? 'invalid_request' : s === 401 ? 'unauthorized' : s === 402 ? 'billing_required'
    : s === 403 ? 'forbidden' : s === 404 ? 'model_unavailable' : s === 408 ? 'timeout'
    : s === 413 ? 'too_large' : s === 429 ? 'quota' : 'service_unavailable';

import { checkGeneratedCode } from '../code3d/validation';
export { checkGeneratedCode } from '../code3d/validation';

export type Code3DResult =
  | { ok: true; code: string; model: string; warnings: string[] }
  | { ok: false; failure: Code3DFailure; model: string; message: string };

/** Exactly one HTTP request per invocation (or zero when the key is missing). */
export async function generateCode3DWithGemini(script: string, aspect: Code3DAspect): Promise<Code3DResult> {
  const model = code3dModel();
  const fail = (failure: Code3DFailure, detail?: string): Code3DResult =>
    ({ ok: false, failure, model, message: code3dFailureText[failure] + (detail ? `: ${detail}` : '') });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail('not_configured');
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(model)) return fail('invalid_request', 'nome de modelo inválido');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 150_000);
  let text = '';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: code3dPrompt(script, aspect) }] }],
        generationConfig: { responseMimeType: 'text/plain', maxOutputTokens: 32768 },
      }),
    });
    if (!res.ok) {
      console.error(`Gemini code3d failed with HTTP ${res.status}`);
      return fail(statusFailure(res.status));
    }
    let data: any;
    try { data = await res.json(); } catch { return fail('invalid_response'); }
    if (data?.promptFeedback?.blockReason) return fail('blocked');
    const c = data?.candidates?.[0];
    if (c?.finishReason === 'SAFETY' || c?.finishReason === 'PROHIBITED_CONTENT') return fail('blocked');
    if (c?.finishReason === 'MAX_TOKENS') return fail('truncated_response');
    const parts = c?.content?.parts ?? [];
    if (!Array.isArray(parts)) return fail('invalid_response');
    text = parts
      .filter((p: any) => p && typeof p.text === 'string' && !p.thought)
      .map((p: any) => p.text).join('');
  } catch (e) {
    const timeout = e instanceof Error && e.name === 'AbortError';
    console.error('Gemini code3d request failed:', timeout ? 'timeout' : 'network');
    return fail(timeout ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!text.trim()) return fail('empty_response');
  const code = extractCode(text);
  if (!code) return fail('no_code');
  const checked = checkGeneratedCode(code);
  if (!checked.ok) return fail(checked.failure, checked.detail);
  return { ok: true, code, model, warnings: checked.warnings };
}
