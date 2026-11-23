import {describe,expect,it} from 'vitest';
import {previewStaticPix,previewDynamicPix,ASAAS_BASE_URL} from './asaasCheckoutPreview';

describe('Asaas payment previews only: never charge production or copy secrets',()=>{
 it('sets R$1 on 3-video intro package from immutable server SKU',()=>{
  const p=previewStaticPix('intro-2d','order_00012','test-pix-key-not-real');
  expect(p.endpoint).toBe('/pix/qrCodes/static');
  expect(p.method).toBe('POST');
  expect(p.payload).toMatchObject({
   value:1,format:'ALL',allowsMultiplePayments:false,
   externalReference:'order_00012',expirationSeconds:900
  });
  // The key of the account is not the price. It is configured elsewhere.
  expect(p.payload.addressKey).toBe('test-pix-key-not-real');
  expect(JSON.stringify(p)).not.toContain('access_token');
 });
 it('changes price by selecting another authorized SKU, not client arbitrary value',()=>{
  const p=previewDynamicPix('creative-2d','order_00123','cus_000005219613','2026-11-30');
  expect(p.payload).toMatchObject({billingType:'PIX',value:9.90,
   customer:'cus_000005219613',externalReference:'order_00123'});
  expect(previewDynamicPix('intro-2d','order_00123','cus_000005219613','2026-11-30').payload.value).toBe(1);
 });
 it('does not provide an API key, allow production endpoints or accept invalid order IDs',()=>{
  expect(ASAAS_BASE_URL.sandbox).toContain('api-sandbox');
  expect(()=>previewStaticPix('intro-2d','../hack','test-pix-key-not-real')).toThrow();
  expect(()=>previewStaticPix('intro-2d','order_123','')).toThrow();
  expect(()=>previewDynamicPix('intro-2d','order_123','bad_customer','2026-11-30')).toThrow();
 });
});