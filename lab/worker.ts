import { directExplainer, DirectorError } from '../src/studio/server/director';
import assets from './generated/assets.json';
interface Environment { GEMINI_API_KEY?: string; GEMINI_TEXT_MODEL?: string }
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
// This deployment must remain owner-private. Its gateway authenticates browser
// and service access. No production database, Lovable key or TTS endpoint exists.
let active = false;
let lastGeneration = 0;
export default { async fetch(request: Request, env: Environment) {
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return json({ error: 'Origem inválida.' }, 403);
    if (url.pathname === '/api/config' && request.method === 'GET') return json({ configured: Boolean(env.GEMINI_API_KEY), provider: 'gemini', voiceEnabled: false });
    if (url.pathname === '/api/connect' && request.method === 'POST') {
      if (!env.GEMINI_API_KEY) return json({ error: 'A chave do Gemini ainda não foi configurada no servidor.' }, 503);
      try {
        const result = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', { headers: { 'x-goog-api-key': env.GEMINI_API_KEY }, signal: AbortSignal.timeout(15000) });
        if (!result.ok) return json({ error: `O Google recusou a conexão (HTTP ${result.status}). Nenhuma geração foi solicitada.` }, 502);
        const data = await result.json() as { models?: { name?: string }[] };
        const model = env.GEMINI_TEXT_MODEL || 'gemini-3.6-flash';
        if (!data.models?.some((item) => item.name === `models/${model}`)) return json({ error: 'A conexão foi aceita, mas o modelo selecionado não aparece nesta conta. Nenhuma geração foi solicitada.' }, 502);
        return json({ message: 'Conexão aceita pelo Google e modelo disponível. A verificação não gerou texto, voz ou vídeo. A cota de geração será conferida somente quando você dirigir um roteiro.' });
      } catch { return json({ error: 'Não foi possível verificar a conexão com Google. Nenhuma geração foi solicitada.' }, 503); }
    }
    if (url.pathname === '/api/direct' && request.method === 'POST') {
      if (active || Date.now() - lastGeneration < 15000) return json({ error: 'Aguarde a direção atual terminar antes de tentar novamente.' }, 429);
      if (Number(request.headers.get('Content-Length') || 0) > 40000) return json({ error: 'O roteiro ultrapassa o tamanho permitido.' }, 413);
      active = true; lastGeneration = Date.now();
      try {
        const body = await request.json() as { script?: unknown; aspect?: unknown };
        return json(await directExplainer({ script: body?.script as string, aspect: body?.aspect }, { AI_TEXT_PROVIDER: 'gemini', GEMINI_API_KEY: env.GEMINI_API_KEY, GEMINI_TEXT_MODEL: env.GEMINI_TEXT_MODEL }));
      } catch (error) {
        return error instanceof DirectorError ? json({ error: error.message, code: error.code }, error.status) : json({ error: 'Não foi possível concluir a direção. O roteiro foi preservado.' }, 503);
      } finally { active = false; }
    }
    return json({ error: 'Rota não disponível.' }, 404);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Método não permitido', { status: 405 });
  const asset = (assets as Record<string, { type: string; body: string }>)[url.pathname === '/' ? '/index.html' : url.pathname];
  if (!asset) return new Response('Página não encontrada', { status: 404 });
  return new Response(request.method === 'HEAD' ? null : asset.body, { headers: { 'Content-Type': asset.type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache' } });
} };
