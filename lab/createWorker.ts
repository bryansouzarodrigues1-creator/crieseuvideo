import { directExplainer, DirectorError, type ActionFailure } from '../src/studio/server/director';

interface Environment { GEMINI_API_KEY?: string; GEMINI_TEXT_MODEL?: string }
type Assets = Record<string, { type: string; body: string }>;
const json = (data: unknown, status = 200, requestId?: string) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...(requestId ? { 'X-CrieSeuVideo-Request-Id': requestId } : {}) },
});

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
      const failure = (status: number, code: string, error: string, details?: ActionFailure) => {
        // Fixed fields only: no source text, model output, key, headers or URLs.
        console.error('LAB_API_FAILURE', JSON.stringify({ requestId, code, status, route: url.pathname, ...(details ? { details } : {}) }));
        return json({ ok: false, status, code, error, requestId, ...(details ? { details } : {}) }, 200, requestId);
      };
      if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403, requestId);
      if (url.pathname === '/api/config' && request.method === 'GET') return json({ configured: Boolean(env.GEMINI_API_KEY), provider: 'gemini', voiceEnabled: false }, 200, requestId);
      if (url.pathname === '/api/connect' && request.method === 'POST') {
        if (!env.GEMINI_API_KEY) return failure(503, 'missing_key', 'A chave do Gemini ainda não foi configurada no servidor.');
        try {
          const result = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
          if (!result.ok) return failure(502, 'connection_rejected', `O Google recusou a conexão (HTTP ${result.status}). Nenhuma geração foi solicitada.`);
          const data = await result.json() as { models?: { name?: string }[] };
          const model = env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
          if (!data.models?.some((item) => item.name === `models/${model}`)) return failure(502, 'unsupported_model', 'A conexão foi aceita, mas o modelo selecionado não aparece nesta conta. Nenhuma geração foi solicitada.');
          return success({ message: 'Conexão aceita pelo Google e modelo disponível. A verificação não gerou texto, voz ou vídeo. A cota de geração será conferida somente quando você dirigir um roteiro.' });
        } catch { return failure(503, 'connection_unavailable', 'Não foi possível verificar a conexão com Google. Nenhuma geração foi solicitada.'); }
      }
      if (url.pathname === '/api/direct' && request.method === 'POST') {
        if (active || Date.now() - lastGeneration < 15000) return failure(429, 'busy', 'Aguarde a direção atual terminar antes de tentar novamente.');
        if (Number(request.headers.get('Content-Length') || 0) > 40000) return failure(413, 'script_too_large', 'O roteiro ultrapassa o tamanho permitido.');
        active = true; lastGeneration = Date.now();
        try {
          const body = await request.json().catch(() => { throw new DirectorError(400, 'invalid_json', 'O pedido não contém um roteiro válido. Seu roteiro foi preservado.'); }) as { script?: unknown; aspect?: unknown; targetDuration?: unknown; engine?: unknown } | null;
          return success(await directExplainer({ script: body?.script as string, aspect: body?.aspect, targetDuration: body?.targetDuration, engine: body?.engine }, { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_TEXT_MODEL: env.GEMINI_TEXT_MODEL }));
        } catch (error) {
          return error instanceof DirectorError
            ? failure(error.status, error.code, error.message, error.details)
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
