/**
 * Isolated, read-only Asaas Sandbox diagnostic.
 * Safe to ship without the checkout PR: no payment creation, credits,
 * webhook processing, customer accounts or financial mutations.
 * Never put ASAAS_API_KEY in browser code.
 */
import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type AsaasConnectionResult = {
  connection: 'connected' | 'not_configured' | 'unauthorized' | 'unavailable' | 'blocked_environment';
  pixKeys: 'one_active' | 'no_active' | 'multiple_active' | 'unavailable' | 'not_checked';
};

/**
 * A POST is deliberate: no URL-side credential caching, GET proxies or prefetch.
 * The middleware verifies the session before the provider is contacted.
 */
export const diagnoseAsaasSandbox = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<AsaasConnectionResult> => {
    setResponseHeader('Cache-Control', 'no-store');
    if (process.env['ASAAS_ENV'] && process.env['ASAAS_ENV'] !== 'sandbox') {
      return { connection: 'blocked_environment', pixKeys: 'not_checked' };
    }
    const apiKey = process.env['ASAAS_API_KEY'];
    if (!apiKey) return { connection: 'not_configured', pixKeys: 'not_checked' };

    const base = 'https://api-sandbox.asaas.com/v3';
    const headers = {
      accept: 'application/json',
      access_token: apiKey,
      'User-Agent': 'CrieSeuVideo/1.0 (read-only sandbox diagnosis)',
    };

    try {
      const status = await fetch(base + '/myAccount/status/', {
        method: 'GET', headers, signal: AbortSignal.timeout(12000),
      });
      if (status.status === 401 || status.status === 403) {
        return { connection: 'unauthorized', pixKeys: 'not_checked' };
      }
      if (!status.ok) return { connection: 'unavailable', pixKeys: 'not_checked' };
    } catch {
      return { connection: 'unavailable', pixKeys: 'not_checked' };
    }

    // A selected address key, if set, stays private; the check never reads it.
    try {
      const res = await fetch(base + '/pix/addressKeys?status=ACTIVE&limit=2', {
        method: 'GET', headers, signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { connection: 'connected', pixKeys: 'unavailable' };
      const body: unknown = await res.json();
      if (!body || typeof body !== 'object' || !('data' in body)) {
        return { connection: 'connected', pixKeys: 'unavailable' };
      }
      const parsed = body as { data?: unknown; hasMore?: unknown };
      if (!Array.isArray(parsed.data) ||
        (parsed.hasMore !== undefined && typeof parsed.hasMore !== 'boolean') ||
        parsed.data.some((v: unknown) => !v || typeof v !== 'object' ||
          (v as { status?: unknown }).status !== 'ACTIVE')) {
        return { connection: 'connected', pixKeys: 'unavailable' };
      }
      const count = parsed.data.length;
      return {
        connection: 'connected',
        pixKeys: count > 1 || parsed.hasMore === true
          ? 'multiple_active'
          : count === 1 ? 'one_active' : 'no_active',
      };
    } catch {
      return { connection: 'connected', pixKeys: 'unavailable' };
    }
  });
