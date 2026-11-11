import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { productionSchema, buildVideoRequest } from './utils/production';

export const listProductions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from('studio_productions').select('*').order('created_at', { ascending: false }).limit(40);
  if (error) throw new Error('Não foi possível carregar suas produções.');
  return data;
});

export const createProduction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((data) => productionSchema.parse(data)).handler(async ({ data, context }) => {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { videoGateway, recordGatewayFailure, GatewayFailure } = await import('./server/video.server');
  const { data: paused } = await supabaseAdmin.from('studio_ai_state').select('*').eq('id', 'video').maybeSingle();
  if (paused) return { error: paused.message, status: paused.status_code };
  const { data: row, error } = await supabaseAdmin.from('studio_productions').insert({ user_id: context.userId, prompt: data.prompt, style: data.style, aspect_ratio: data.aspectRatio, duration: data.duration, resolution: data.resolution }).select().single();
  if (error || !row) return { error: error?.code === '23505' ? 'Uma produção já está em andamento. Aguarde sua conclusão.' : 'Não foi possível iniciar a produção.', status: 409 };
  try {
    const response = await videoGateway('', buildVideoRequest(data));
    const job = await response.json() as { id: string; status: string; progress?: number; error?: { message?: string } };
    if (!job.id) throw new Error('A IA não devolveu a identificação da produção.');
    const { error: saveError } = await supabaseAdmin.from('studio_productions').update({ gateway_id: job.id, status: job.status, progress: job.progress || 0, error_message: job.error?.message || null }).eq('id', row.id);
    if (saveError) throw new Error('A IA iniciou a produção, mas não foi possível registrar seu andamento.');
    return { id: row.id };
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : 'A produção não foi iniciada.';
    // A transport failure can hide an accepted/billed job. Keep the slot locked,
    // rather than allowing another click to silently create a duplicate.
    await supabaseAdmin.from('studio_productions').update({ status: failure instanceof GatewayFailure ? 'failed' : 'creating', error_message: message }).eq('id', row.id);
    await recordGatewayFailure(failure);
    return { error: message, status: failure instanceof GatewayFailure ? failure.status : 500 };
  }
});

export const refreshProduction = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data)).handler(async ({ data, context }) => {
  const { data: row, error } = await context.supabase.from('studio_productions').select('*').eq('id', data.id).single();
  if (error || !row) throw new Error('Produção não encontrada.');
  if (row.storage_path) {
    const { data: signed, error: signError } = await context.supabase.storage.from('studio-videos').createSignedUrl(row.storage_path, 3600);
    if (signError || !signed) throw new Error('Não foi possível abrir este vídeo.');
    return { ...row, url: signed.signedUrl };
  }
  if (row.status === 'failed' || !row.gateway_id) return { ...row, url: null };
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { videoGateway, storeVideo, recordGatewayFailure } = await import('./server/video.server');
  const { data: paused } = await supabaseAdmin.from('studio_ai_state').select('*').eq('id', 'video').maybeSingle();
  if (paused) throw new Error(paused.message);
  try {
    const response = await videoGateway(`/${encodeURIComponent(row.gateway_id)}`);
    const job = await response.json() as { status: string; progress?: number; error?: { message?: string } };
    let storagePath: string | null = null;
    if (job.status === 'completed') storagePath = await storeVideo(context.userId, row.id, row.gateway_id);
    const update = { status: job.status, progress: job.progress || (job.status === 'completed' ? 100 : 0), error_message: job.error?.message || null, storage_path: storagePath };
    const { error: saveError } = await supabaseAdmin.from('studio_productions').update(update).eq('id', row.id).eq('user_id', context.userId);
    if (saveError) throw new Error('Não foi possível salvar o andamento.');
    let url: string | null = null;
    if (storagePath) {
      const { data: signed } = await context.supabase.storage.from('studio-videos').createSignedUrl(storagePath, 3600);
      url = signed?.signedUrl || null;
    }
    return { ...row, ...update, url };
  } catch (failure) { await recordGatewayFailure(failure); throw failure; }
});