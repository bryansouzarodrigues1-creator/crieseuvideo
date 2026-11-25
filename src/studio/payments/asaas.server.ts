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
 if (!apiKey) throw new Error('API Key do Asaas Sandbox não configurada.');
 return { apiKey };
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

/**
 * Reuse an already active receiving Pix key. Never create a new DICT key
 * automatically and never guess which key to use when multiple are active.
 * An operator may still pin ASAAS_PIX_ADDRESS_KEY as a server secret.
 */
export async function findUniqueActivePixKeySandbox(): Promise<string> {
 const res = await asaasRequest('/pix/addressKeys?status=ACTIVE&limit=100') as {
   data?: Array<{ key?: unknown; status?: unknown }>;
   hasMore?: boolean;
 };
 const keys = (res.data ?? [])
   .filter((entry) => entry.status === 'ACTIVE' && typeof entry.key === 'string' && entry.key.length > 5);
 if (!Array.isArray(res.data) || res.hasMore || keys.length !== 1) {
   throw new Error('O Asaas Sandbox precisa ter exatamente uma chave Pix ativa, ou configure ASAAS_PIX_ADDRESS_KEY explicitamente.');
 }
 return keys[0].key as string;
}

/**
 * Independent reconciliation when a webhook has not been configured yet.
 * Never trust status supplied by the browser or a webhook body.
 */
export async function listStaticPixPaymentIdsSandbox(qrId: string): Promise<string[]> {
 if (!/^[A-Za-z0-9_-]{4,150}$/.test(qrId)) throw new Error('Identificador de QR inválido.');
 const body = await asaasRequest('/payments?pixQrCodeId=' + encodeURIComponent(qrId) + '&limit=20') as {
   data?: Array<{ id?: unknown }>;
   hasMore?: boolean;
 };
 if (!Array.isArray(body.data) || body.hasMore) throw new Error('Resposta de pagamentos incompleta.');
 return body.data.map(p => p.id).filter((id): id is string =>
   typeof id === 'string' && /^pay_[A-Za-z0-9_-]{4,100}$/.test(id));
}

/**
 * Read-only checkout readiness. Only returns the NUMBER of active receiving
 * Pix keys, never the key values, credentials or account details.
 * Unavailable/ambiguous responses fail closed; no setup is mutated.
 * Uses only ASAAS_API_KEY and the Sandbox URL, with no checkout flag.
 */
export async function checkAsaasSandboxPixKeyReadiness(): Promise<
 'configured' | 'one_active' | 'no_active' | 'multiple_active' | 'unavailable'
> {
 if (process.env['ASAAS_ENV'] && process.env['ASAAS_ENV'] !== 'sandbox')
  return 'unavailable';
 const apiKey = process.env['ASAAS_API_KEY'];
 if (!apiKey) return 'unavailable';
 // Explicitly selected keys stay server-side, even when multiple keys exist.
 if (process.env['ASAAS_PIX_ADDRESS_KEY']) return 'configured';
 try {
  const response = await fetch(ASAAS_BASE_URL.sandbox + '/pix/addressKeys?status=ACTIVE&limit=2', {
   method: 'GET',
   headers: { accept: 'application/json', access_token: apiKey,
    'User-Agent': 'CrieSeuVideo/0.1 (sandbox)' },
   signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) return 'unavailable';
  const parsed: unknown = await response.json();
  if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return 'unavailable';
  const data = (parsed as { data?: unknown; hasMore?: unknown }).data;
  const hasMore = (parsed as { hasMore?: unknown }).hasMore;
  if (!Array.isArray(data) || (hasMore !== undefined && typeof hasMore !== 'boolean'))
   return 'unavailable';
  if (data.some(k => !k || k.status !== 'ACTIVE' || typeof k.key !== 'string'))
   return 'unavailable';
  if (data.length > 1 || hasMore === true) return 'multiple_active';
  return data.length === 1 ? 'one_active' : 'no_active';
 } catch { return 'unavailable'; }
}

export async function createStaticPixSandbox(orderId: string): Promise<{ id: string; payload: string }> {
 sandboxConfig();
 const pixKey = process.env['ASAAS_PIX_ADDRESS_KEY'] || await findUniqueActivePixKeySandbox();
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

/**
 * Read-only connectivity probe for server operators.
 * Does not create orders, Pix QRs, payments, or expose account details.
 * This is intentionally NOT mapped to a public HTTP endpoint.
 * It works with only ASAAS_API_KEY and ASAAS_ENV=sandbox configured.
 */
export async function probeAsaasSandboxCredential(): Promise<
  { ok: true } | { ok: false; reason: 'wrong_environment' | 'key_missing' | 'unauthorized' | 'provider_unavailable' }
> {
  if (process.env['ASAAS_ENV'] && process.env['ASAAS_ENV'] !== 'sandbox') {
    return { ok: false, reason: 'wrong_environment' };
  }
  const apiKey = process.env['ASAAS_API_KEY'];
  if (!apiKey) return { ok: false, reason: 'key_missing' };
  try {
    const response = await fetch(ASAAS_BASE_URL.sandbox + '/myAccount/status/', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': apiKey,
        'User-Agent': 'CrieSeuVideo/0.1 (sandbox)',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 401 || response.status === 403) {
      return { ok: false, reason: 'unauthorized' };
    }
    return response.ok ? { ok: true } : { ok: false, reason: 'provider_unavailable' };
  } catch {
    return { ok: false, reason: 'provider_unavailable' };
  }
}
