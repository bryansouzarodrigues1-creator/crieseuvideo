import { supabaseAdmin } from '@/integrations/supabase/client.server';

export class GatewayFailure extends Error {
  constructor(public status: number, message: string, public kind: string) { super(message); }
}

export async function videoGateway(path: string, body?: unknown) {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new GatewayFailure(401, 'A geração por IA não está configurada.', 'configuration');
  const response = await fetch(`https://ai.gateway.lovable.dev/v1/videos${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Lovable-AIG-SDK': 'fetch' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string; type?: string };
    throw new GatewayFailure(response.status, error.message || `A geração retornou o erro ${response.status}.`, error.type || 'gateway');
  }
  return response;
}

export async function recordGatewayFailure(error: unknown) {
  if (!(error instanceof GatewayFailure)) return;
  if (error.status === 402 || error.status === 403) {
    const { error: saveError } = await supabaseAdmin.from('studio_ai_state').upsert({ id: 'video', status_code: error.status, message: error.message, kind: error.kind, updated_at: new Date().toISOString() });
    if (saveError) throw new Error('Não foi possível registrar a pausa da IA.');
  }
}

export async function storeVideo(userId: string, productionId: string, gatewayId: string) {
  const path = `${userId}/${productionId}.mp4`;
  const { data: existing } = await supabaseAdmin.storage.from('studio-videos').list(userId, { search: `${productionId}.mp4` });
  if (!existing?.some((file) => file.name === `${productionId}.mp4`)) {
    const response = await videoGateway(`/${encodeURIComponent(gatewayId)}/content`);
    const bytes = await response.arrayBuffer();
    const { error } = await supabaseAdmin.storage.from('studio-videos').upload(path, bytes, { contentType: 'video/mp4', upsert: false });
    if (error && !error.message.toLowerCase().includes('already exists')) throw new Error('O vídeo foi gerado, mas ainda não foi salvo. Retome a consulta para guardar a produção.');
  }
  return path;
}