import { directExplainer, DirectorError, type ActionFailure } from '../src/studio/server/director';
import { preflightGemini } from '../src/studio/server/ai';
import type { SceneProgramCandidate } from '../src/studio/explainer/sceneProgram/candidate';

interface Environment { GEMINI_API_KEY?: string; GEMINI_TEXT_MODEL?: string }
type Assets = Record<string, { type: string; body: string }>;
const json = (data: unknown, status = 200, requestId?: string) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...(requestId ? { 'X-CrieSeuVideo-Request-Id': requestId } : {}) },
});
async function readDirectionBody(request: Request) {
  const reader = request.body?.getReader(); if (!reader) throw new DirectorError(400, 'invalid_json', 'O pedido não contém um roteiro válido.');
  let length = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const { value, done } = await reader.read(); if (done) break; length += value.byteLength; if (length > 120000) { await reader.cancel(); throw new DirectorError(413, 'script_too_large', 'O pedido ultrapassa o tamanho permitido. Nenhuma geração foi solicitada.'); } chunks.push(value); }
    const bytes = new Uint8Array(length); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new DirectorError(400, 'invalid_json', 'O pedido não contém um roteiro válido. Seu roteiro foi preservado.'); }
  } finally { reader.releaseLock(); }
}

/**
 * The private lab uses explicit RPC results for direction/connection failures.
 * Hosting gateways may replace HTTP 5xx with an HTML error page. Application
 * failures travel as {ok:false,status,code,error,requestId} over HTTP 200.
 * Authentication, origin checks and unknown routes retain 4xx. The production
 * API keeps its normal HTTP status contract. No automatic retry is performed.
 */
export function createLabWorker(assets: Assets) {
  let active = false;
  let lastGeneration = 0;
  return { async fetch(request: Request, env: Environment) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const requestId = crypto.randomUUID();
      const success = (data: object) => json({ ...data, ok: true }, 200, requestId);
      const failure = (status: number, code: string, error: string, details?: ActionFailure, candidate?: SceneProgramCandidate) => {
        // Fixed fields only: no source text, model output, key, headers or URLs.
        console.error('LAB_API_FAILURE', JSON.stringify({ requestId, code, status, route: url.pathname, ...(details ? { details } : {}) }));
        return json({ ok: false, status, code, error, requestId, ...(details ? { details } : {}), ...(candidate ? { candidate } : {}) }, 200, requestId);
      };
      if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403, requestId);
      if (url.pathname === '/api/config' && request.method === 'GET') return json({ configured: Boolean(env.GEMINI_API_KEY), provider: 'gemini', voiceEnabled: false }, 200, requestId);
      if (url.pathname === '/api/connect' && request.method === 'POST') {
        const result = await preflightGemini(env);
        return result.ok
          ? success({ message: 'Conexão e contagem de teste aceitas pelo Google. Nenhum texto, voz ou vídeo foi gerado. A direção de um roteiro ainda precisa ser conferida.', preflight: { model: result.model, totalTokens: result.totalTokens, requestFormat: 'json-mime-v1', generationRequested: false } })
          : failure(result.code === 'missing_key' ? 503 : 502, result.code, 'O Google não aceitou a pré-verificação da conexão. Nenhuma geração foi solicitada.');
      }
      if (url.pathname === '/api/direct' && request.method === 'POST') {
        if (active || Date.now() - lastGeneration < 15000) return failure(429, 'busy', 'Aguarde a direção atual terminar antes de tentar novamente.');
        if (Number(request.headers.get('Content-Length') || 0) > 120000) return failure(413, 'script_too_large', 'O pedido ultrapassa o tamanho permitido.');
        active = true; lastGeneration = Date.now();
        try {
          const body = await readDirectionBody(request) as { script?: unknown; aspect?: unknown; targetDuration?: unknown; engine?: unknown; mode?: unknown; previousProgram?: unknown; previousProposal?: unknown; repairIssue?: unknown } | null;
          return success(await directExplainer({ script: body?.script as string, aspect: body?.aspect, targetDuration: body?.targetDuration, engine: body?.engine, mode: body?.mode === 'program' ? 'program' : undefined, previousProgram: body?.previousProgram, previousProposal: body?.previousProposal, repairIssue: body?.repairIssue, requireActing: body?.engine !== '2d' }, { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_TEXT_MODEL: env.GEMINI_TEXT_MODEL }));
        } catch (error) {
          return error instanceof DirectorError
            ? failure(error.status, error.code, error.message, error.details, error.candidate)
            : failure(503, 'internal', 'Não foi possível concluir a direção. O roteiro foi preservado.');
        } finally { active = false; }
      }
      return json({ error: 'Rota não disponível.' }, 404, requestId);
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
    const asset = assets[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!asset) return new Response('Página não encontrada', { status: 404 });
    return new Response(request.method === 'HEAD' ? null : asset.body, { headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
  } };
}
