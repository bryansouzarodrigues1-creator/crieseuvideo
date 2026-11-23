/**
 * Server-only Asaas sandbox adapter. PRODUCTION IS HARD-DISABLED.
 * API keys and Pix receiver key are read from server Secrets only.
 */
import { ASAAS_BASE_URL, previewStaticPix } from './asaasCheckoutPreview';
import type { VerifiedAsaasPayment } from './asaasVerification';

function sandboxConfig() {
 if (process.env['ASAAS_CHECKOUT_ENABLED'] !== 'true' || process.env['ASAAS_ENV'] !== 'sandbox') {
   throw new Error('Checkout Pix desativado. Ative somente após homologação no Sandbox.');
 }
 const apiKey = process.env['ASAAS_API_KEY'];
 const pixKey = process.env['ASAAS_PIX_ADDRESS_KEY'];
 const webhookToken = process.env['ASAAS_WEBHOOK_TOKEN'];
 if (!apiKey || !pixKey || !webhookToken) throw new Error('Configuração Asaas Sandbox incompleta.');
 return { apiKey, pixKey };
}
async function asaasRequest(path: string, init?: RequestInit): Promise<unknown> {
 const { apiKey } = sandboxConfig();
 const response = await fetch(ASAAS_BASE_URL.sandbox + path, {
   ...init,
   headers: {
     'accept': 'application/json',
     'content-type': 'application/json',
     'access_token': apiKey,
     'User-Agent': 'CrieSeuVideo/0.1 (sandbox)',
   },
   signal: AbortSignal.timeout(12000),
 });
 if (!response.ok) throw new Error('Asaas Sandbox respondeu HTTP ' + response.status);
 return response.json();
}
export async function createStaticPixSandbox(orderId: string): Promise<{ id: string; payload: string }> {
 const { pixKey } = sandboxConfig();
 const preview = previewStaticPix('intro-2d', orderId, pixKey);
 const body = await asaasRequest(preview.endpoint, {
   method: preview.method,
   body: JSON.stringify(preview.payload),
 }) as { id?: unknown; payload?: unknown };
 if (typeof body?.id !== 'string' || body.id.length < 4 ||
     typeof body.payload !== 'string' || body.payload.length < 10) {
   throw new Error('Asaas devolveu QR Code inválido.');
 }
 return { id: body.id, payload: body.payload };
}
export async function fetchAsaasPaymentSandbox(paymentId: string): Promise<VerifiedAsaasPayment> {
 if (!/^pay_[A-Za-z0-9_-]{4,100}$/.test(paymentId)) throw new Error('ID Asaas inválido.');
 const p = await asaasRequest('/payments/' + encodeURIComponent(paymentId)) as Partial<VerifiedAsaasPayment>;
 if (!p || p.id !== paymentId || typeof p.value !== 'number' ||
     typeof p.billingType !== 'string' || typeof p.status !== 'string') {
   throw new Error('Resposta de conciliação Asaas inválida.');
 }
 return p as VerifiedAsaasPayment;
}
