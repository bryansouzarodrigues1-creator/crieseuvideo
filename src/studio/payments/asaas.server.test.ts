import { afterEach, describe, expect, it, vi } from 'vitest';
import { probeAsaasSandboxCredential } from './asaas.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Read-only Asaas Sandbox credential verification', () => {
 it('never calls the provider if environment is not sandbox', async () => {
  vi.stubEnv('ASAAS_ENV', 'production');
  vi.stubEnv('ASAAS_API_KEY', 'sandbox-test-placeholder');
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  expect(await probeAsaasSandboxCredential()).toEqual({ ok: false, reason: 'wrong_environment' });
  expect(fetchSpy).not.toHaveBeenCalled();
 });
 it('rejects missing secret without a network call', async () => {
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_API_KEY', '');
  const fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
  expect(await probeAsaasSandboxCredential()).toEqual({ ok: false, reason: 'key_missing' });
  expect(fetchSpy).not.toHaveBeenCalled();
 });
 it('calls only the read-only sandbox status endpoint without echoing credentials', async () => {
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_API_KEY', 'sandbox-test-placeholder');
  const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
  vi.stubGlobal('fetch', fetchSpy);
  expect(await probeAsaasSandboxCredential()).toEqual({ ok: true });
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url, options] = fetchSpy.mock.calls[0];
  expect(url).toBe('https://api-sandbox.asaas.com/v3/myAccount/status/');
  expect(options.method).toBe('GET');
  expect(options.body).toBeUndefined();
  expect(options.headers.access_token).toBe('sandbox-test-placeholder');
 });
 it('rejects unauthorized provider response and does not reveal details', async () => {
  vi.stubEnv('ASAAS_ENV', 'sandbox');
  vi.stubEnv('ASAAS_API_KEY', 'sandbox-test-placeholder');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
  expect(await probeAsaasSandboxCredential()).toEqual({ ok: false, reason: 'unauthorized' });
 });
});
