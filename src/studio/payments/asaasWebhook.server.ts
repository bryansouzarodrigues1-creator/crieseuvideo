import type { SupabaseClient } from '@supabase/supabase-js';
import { matchesReceivedStaticPix } from './asaasVerification';

/**
 * Asaas callback endpoint; webhook token and provider GET must BOTH validate.
 * No real money accepted: sandbox-only feature flag throughout the integration.
 */
async function sameSecret(a: string, b: string): Promise<boolean> {
 const encoder = new TextEncoder();
 const [x, y] = await Promise.all([
  crypto.subtle.digest('SHA-256', encoder.encode(a)),
  crypto.subtle.digest('SHA-256', encoder.encode(b)),
 ]);
 const aa = new Uint8Array(x), bb = new Uint8Array(y);
 let diff = aa.length ^ bb.length;
 for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
 return diff === 0;
}

export async function handleAsaasWebhook(request: Request): Promise<Response> {
 if (process.env['ASAAS_CHECKOUT_ENABLED'] !== 'true' || process.env['ASAAS_ENV'] !== 'sandbox') {
  return Response.json({ error: 'inactive' }, { status: 503 });
 }
 const expected = process.env['ASAAS_WEBHOOK_TOKEN'];
 const sent = request.headers.get('asaas-access-token') ?? '';
 if (!expected || !sent || !await sameSecret(sent, expected)) {
  return Response.json({ error: 'unauthorized' }, { status: 401 });
 }
 const raw = await request.text();
 if (raw.length > 70_000) return Response.json({ error: 'too_large' }, { status: 413 });
 let body: unknown;
 try { body = JSON.parse(raw); }
 catch { return Response.json({ error: 'invalid_json' }, { status: 400 }); }
 if (!body || typeof body !== 'object') return Response.json({ error: 'invalid_body' }, { status: 400 });
 const event = body as { id?: unknown; event?: unknown; payment?: { id?: unknown } };
 if (event.event !== 'PAYMENT_RECEIVED') {
  // Other statuses (including refunds) need a separate dedicated policy.
  return Response.json({ ok: true, ignored: true });
 }
 if (typeof event.id !== 'string' || !event.id.startsWith('evt_') || event.id.length > 200 || event.id.length < 5 ||
     typeof event.payment?.id !== 'string' || !/^pay_[A-Za-z0-9_-]{4,100}$/.test(event.payment.id)) {
  return Response.json({ error: 'invalid_event' }, { status: 400 });
 }
 try {
  const { fetchAsaasPaymentSandbox } = await import('./asaas.server');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const payment = await fetchAsaasPaymentSandbox(event.payment.id);
  // Find an order by the provider-returned QR identifier, not externalReference
  // or arbitrary client/user data in the callback.
  if (!payment.pixQrCodeId) return Response.json({ ok: true, ignored: true });
  const db = supabaseAdmin as unknown as SupabaseClient;
  const { data: order, error: findError } = await db.from('csv_payment_orders')
   .select('id, provider_qr_id, amount_cents, state')
   .eq('provider_qr_id', payment.pixQrCodeId).maybeSingle();
  if (findError) throw findError;
  if (!order) return Response.json({ ok: true, ignored: true });
  if (order.state === 'paid') return Response.json({ ok: true, alreadyProcessed: true });
  if (!matchesReceivedStaticPix(payment, order)) {
   return Response.json({ error: 'payment_not_reconciled' }, { status: 409 });
  }
  // An atomic SQL transaction deduplicates by payment ID + event ID + order
  // and writes the paid status, ledger entry and +3 wallet balance together.
  // Asaas IDs may contain '&'. Hash the ID to a stable safe identifier accepted
  // by the database RPC (without changing the original provider event semantics).
  const rawEventBytes = new TextEncoder().encode(event.id);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', rawEventBytes));
  const eventKey = 'evt_' + Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  const { data: applied, error: rpcError } = await db.rpc('csv_apply_verified_payment', {
   p_order_id: order.id, p_provider_payment_id: payment.id, p_event_id: eventKey,
  });
  if (rpcError) throw rpcError;
  return Response.json({ ok: true, result: applied });
 } catch (error) {
  console.error('Asaas payment reconciliation failed', error instanceof Error ? error.message : 'unknown error');
  // Non-2xx causes Asaas to retry transient processing errors.
  return Response.json({ error: 'retry_later' }, { status: 503 });
 }
}
