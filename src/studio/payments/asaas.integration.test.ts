import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStaticPixSandbox, findUniqueActivePixKeySandbox, listStaticPixPaymentIdsSandbox } from './asaas.server';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function sandbox() {
 vi.stubEnv('ASAAS_ENV','sandbox');
 vi.stubEnv('ASAAS_CHECKOUT_ENABLED','true');
 vi.stubEnv('ASAAS_API_KEY','sandbox-placeholder');
 vi.stubEnv('ASAAS_PIX_ADDRESS_KEY','');
}
const ok = (v: unknown) => ({ ok:true, json: async () => v });

describe('Asaas Sandbox single-API-key compatibility', () => {
 it('reuses the only active Pix key instead of creating one', async () => {
  sandbox();
  const fetchSpy=vi.fn().mockResolvedValue(ok({data:[{key:'123e4567-e89b-12d3-a456-426614174000',status:'ACTIVE'}],hasMore:false}));
  vi.stubGlobal('fetch',fetchSpy);
  expect(await findUniqueActivePixKeySandbox()).toMatch(/^123e/);
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const [url,options]=fetchSpy.mock.calls[0];
  expect(url).toContain('/pix/addressKeys?status=ACTIVE&limit=100');
  expect(options.method).toBeUndefined();
  expect(options.body).toBeUndefined();
 });
 it('never guesses an active key if there is more than one', async () => {
  sandbox();
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(ok({data:[{key:'abcabc123',status:'ACTIVE'},{key:'defdef123',status:'ACTIVE'}],hasMore:false})));
  await expect(findUniqueActivePixKeySandbox()).rejects.toThrow('exatamente uma');
 });
 it('generates a one-time static QR using only API key plus existing Pix key', async () => {
  sandbox();
  const spy=vi.fn()
   .mockResolvedValueOnce(ok({data:[{key:'123e4567-e89b-12d3-a456-426614174000',status:'ACTIVE'}],hasMore:false}))
   .mockResolvedValueOnce(ok({id:'qr_test_0001',payload:'0002010102112685TESTPAYLOAD'}));
  vi.stubGlobal('fetch',spy);
  const qr=await createStaticPixSandbox('test_order_12345');
  expect(qr.id).toBe('qr_test_0001');
  const [url,init]=spy.mock.calls[1];
  expect(url).toBe('https://api-sandbox.asaas.com/v3/pix/qrCodes/static');
  expect(init.method).toBe('POST');
  const data=JSON.parse(init.body);
  expect(data.addressKey).toMatch(/^123e/);
  expect(data.value).toBe(1);
  expect(data.allowsMultiplePayments).toBe(false);
 });
 it('queries provider payments by QR without trusting browser-supplied paid status', async () => {
  sandbox();
  const spy=vi.fn().mockResolvedValue(ok({data:[{id:'pay_abc12345'}],hasMore:false}));
  vi.stubGlobal('fetch',spy);
  expect(await listStaticPixPaymentIdsSandbox('qr_test_001')).toEqual(['pay_abc12345']);
  expect(spy.mock.calls[0][0]).toContain('/payments?pixQrCodeId=qr_test_001');
 });
});
