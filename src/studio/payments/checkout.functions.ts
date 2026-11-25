import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { planPriceForVerifiedServerOrder } from '@/studio/pricing/catalog';

/**
 * No browser-supplied amount, user id, credit count, payment state or Pix key.
 * Even with valid user authentication this endpoint is DISABLED unless
 * ASAAS_CHECKOUT_ENABLED=true and ASAAS_ENV=sandbox (never production).
 */
export const startIntroPixSandbox = createServerFn({ method: 'POST' })
 .middleware([requireSupabaseAuth])
 .inputValidator((value) => z.object({ requestId: z.string().uuid() }).parse(value))
 .handler(async ({ data, context }) => {
  if (process.env['ASAAS_CHECKOUT_ENABLED'] !== 'true' || process.env['ASAAS_ENV'] !== 'sandbox') {
   return { ok: false as const, error: 'Pagamento indisponível. Integração em testes.', orderId: null, pix: null };
  }
  const { data: account, error: authError } = await context.supabase.auth.getUser();
  const providers = account.user?.app_metadata?.providers;
  const linkedGoogle = account.user?.app_metadata?.provider === 'google' ||
   (Array.isArray(providers) && providers.includes('google'));
  if (authError || !account.user || account.user.id !== context.userId || !linkedGoogle) {
   return { ok: false as const, error: 'Entre com sua conta Google antes de pagar.', orderId: null, pix: null };
  }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { amountCents, credits } = planPriceForVerifiedServerOrder('intro-2d');
  const { data: previous, error: previousError } = await db.from('csv_payment_orders')
    .select('id, state, qr_payload, expires_at')
    .eq('user_id', context.userId).eq('request_id', data.requestId).maybeSingle();
  if (previousError) throw new Error('Não foi possível consultar o pedido.');
  if (previous) {
   if (previous.state === 'pending' && previous.qr_payload) {
    return { ok: true as const, orderId: previous.id as string, pix: previous.qr_payload as string, error: null };
   }
   return { ok: false as const, error: 'Pedido em processamento. Consulte seu histórico antes de tentar novamente.', orderId: previous.id as string, pix: null };
  }
  if (!process.env['ASAAS_API_KEY']) {
   return { ok: false as const, error: 'Asaas Sandbox não configurado no servidor.', orderId: null, pix: null };
  }
  const { data: order, error: insertError } = await db.from('csv_payment_orders')
   .insert({ user_id: context.userId, request_id: data.requestId,
    sku: 'intro-2d', amount_cents: amountCents, credit_count: credits,
    state: 'creating' }).select('id').single();
  if (insertError || !order) {
   return { ok: false as const, error: 'Não foi possível abrir o pedido. Tente novamente.', orderId: null, pix: null };
  }
  try {
   const { createStaticPixSandbox } = await import('./asaas.server');
   const qr = await createStaticPixSandbox(order.id as string);
   const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
   const { error: updateError } = await db.from('csv_payment_orders')
    .update({ state: 'pending', provider_qr_id: qr.id, qr_payload: qr.payload,
     expires_at: expiresAt })
    .eq('id', order.id).eq('state', 'creating');
   if (updateError) throw new Error('Não foi possível persistir o QR Code.');
   return { ok: true as const, orderId: order.id as string, pix: qr.payload, error: null };
  } catch {
   // A response may be lost after Asaas created the QR. Do not retry automatically.
   await db.from('csv_payment_orders').update({ state: 'failed' })
    .eq('id', order.id).eq('state', 'creating');
   return { ok: false as const, error: 'QR Code não foi concluído. Não realize pagamento sem um pedido confirmado.', orderId: order.id as string, pix: null };
  }
 });

export const getMyPixOrder = createServerFn({ method: 'GET' })
 .middleware([requireSupabaseAuth])
 .inputValidator((value) => z.object({ orderId: z.string().uuid() }).parse(value))
 .handler(async ({ data, context }) => {
  const db = context.supabase as unknown as SupabaseClient;
  const { data: order, error } = await db.from('csv_payment_orders')
   .select('id, sku, state, amount_cents, credit_count, qr_payload, expires_at, paid_at')
   .eq('id', data.orderId).eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error('Erro ao consultar o pagamento.');
  if (!order) return null;
  return order;
 });

export const getMyVideoCredits = createServerFn({ method: 'GET' })
 .middleware([requireSupabaseAuth])
 .handler(async ({ context }) => {
  const db = context.supabase as unknown as SupabaseClient;
  const { data, error } = await db.from('csv_credit_wallets')
   .select('balance').eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error('Erro ao consultar créditos.');
  return { balance: Number(data?.balance ?? 0) };
 });

/**
 * Manual sandbox-only reconciliation while the Asaas webhook is not configured.
 * The signed-in user can only inspect their own order. Credits are applied in
 * a privileged, idempotent database transaction AFTER re-fetching provider data.
 * Never enable outside a dedicated sandbox deployment.
 */
export const verifyMyPixSandboxPayment = createServerFn({ method: 'POST' })
 .middleware([requireSupabaseAuth])
 .inputValidator((value) => z.object({ orderId: z.string().uuid() }).parse(value))
 .handler(async ({ data, context }) => {
  if (process.env['ASAAS_CHECKOUT_ENABLED'] !== 'true' || process.env['ASAAS_ENV'] !== 'sandbox') {
   return { state: 'disabled' as const };
  }
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { listStaticPixPaymentIdsSandbox, fetchAsaasPaymentSandbox } = await import('./asaas.server');
  const { matchesReceivedStaticPix } = await import('./asaasVerification');
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { data: order, error } = await db.from('csv_payment_orders')
   .select('id, user_id, state, provider_qr_id, amount_cents')
   .eq('id', data.orderId).eq('user_id', context.userId).maybeSingle();
  if (error) throw new Error('Falha ao consultar pedido');
  if (!order) return { state: 'not_found' as const };
  if (order.state === 'paid') return { state: 'paid' as const };
  if (order.state !== 'pending' || typeof order.provider_qr_id !== 'string') {
   return { state: 'pending' as const };
  }
  const ids = await listStaticPixPaymentIdsSandbox(order.provider_qr_id);
  for (const id of ids) {
   const payment = await fetchAsaasPaymentSandbox(id);
   if (!matchesReceivedStaticPix(payment, order)) continue;
   // Deterministic id for retry/deduplication; webhook can later arrive separately.
   const { error: grantError } = await db.rpc('csv_apply_verified_payment', {
    p_order_id: order.id,
    p_provider_payment_id: payment.id,
    p_event_id: 'poll_' + payment.id,
   });
   if (grantError) {
    // A competing webhook may have settled the same order: re-read before failing.
    const { data: settled } = await db.from('csv_payment_orders').select('state')
     .eq('id', order.id).eq('user_id', context.userId).maybeSingle();
    if (settled?.state !== 'paid') throw new Error('Falha ao registrar pagamento confirmado.');
   }
   return { state: 'paid' as const };
  }
  return { state: 'pending' as const };
 });

/**
 * Test-only read-only provider check. No checkout or Pix key needed.
 * Returns no account or credential data.
 */
export const checkAsaasSandboxConnection = createServerFn({ method: 'POST' })
 .middleware([requireSupabaseAuth])
 .handler(async () => {
   const { probeAsaasSandboxCredential, checkAsaasSandboxPixKeyReadiness } = await import('./asaas.server');
   const connection = await probeAsaasSandboxCredential();
   if (!connection.ok) return { ...connection, pixKeys: 'unavailable' as const };
   const pixKeys = await checkAsaasSandboxPixKeyReadiness();
   return { ok: true as const, pixKeys };
 });
