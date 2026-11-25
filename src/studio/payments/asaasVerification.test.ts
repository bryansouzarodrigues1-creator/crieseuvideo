import { describe, expect, it } from 'vitest';
import { matchesReceivedStaticPix } from './asaasVerification';

const order = { provider_qr_id: 'qr_ABC123', amount_cents: 100, state: 'pending' };
const paid = { id: 'pay_123456', status: 'RECEIVED', billingType: 'PIX', value: 1, pixQrCodeId: 'qr_ABC123' };

describe('Asaas settled static Pix reconciliation', () => {
 it('requires a matching settled payment and exact amount', () => {
   expect(matchesReceivedStaticPix(paid, order)).toBe(true);
   expect(matchesReceivedStaticPix({ ...paid, value: 0.99 }, order)).toBe(false);
   expect(matchesReceivedStaticPix({ ...paid, value: 1.01 }, order)).toBe(false);
   expect(matchesReceivedStaticPix({ ...paid, pixQrCodeId: 'qr_other' }, order)).toBe(false);
 });
 it('rejects wrong type, pending, replay against a paid order and invalid id', () => {
   expect(matchesReceivedStaticPix({ ...paid, billingType: 'BOLETO' }, order)).toBe(false);
   expect(matchesReceivedStaticPix({ ...paid, status: 'CONFIRMED' }, order)).toBe(false);
   expect(matchesReceivedStaticPix({ ...paid, id: '../evil' }, order)).toBe(false);
   expect(matchesReceivedStaticPix(paid, { ...order, state: 'paid' })).toBe(false);
 });
});
