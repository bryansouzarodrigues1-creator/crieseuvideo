import {describe,it,expect} from 'vitest';
import {
 INTRO_PACK_CREDITS,INTRO_PACK_PRICE_CENTS,submitManualProof,markUnderReview,
 rejectProof,decideCreditGrant,type PaymentRecord
} from './receiptReviewPolicy';

const manual:PaymentRecord={orderId:'ord-1',userId:'u-1',method:'manual_bank_pix',stage:'waiting_payment'};
const staticQr:PaymentRecord={orderId:'ord-2',userId:'u-1',method:'asaas_static_qr',stage:'waiting_payment'};
const confirmed={type:'manual_bank_statement' as const,adminAuthorized:true as const,bankTransactionId:'E2E-55',receivedAmountCents:100 as const,destinationAccountMatched:true as const};
const asaas={type:'asaas_verified_event' as const,webhookAuthenticated:true as const,providerPaymentId:'pay-1',receivedAmountCents:100 as const,paymentStatus:'RECEIVED' as const,transactionMatched:true as const};
describe('one Pix purchase = three credits, only after financial verification',()=>{
 it('keeps click/upload and screenshot separate from cleared funds',()=>{
  expect(INTRO_PACK_CREDITS).toBe(3);expect(INTRO_PACK_PRICE_CENTS).toBe(100);
  expect(decideCreditGrant(manual,undefined,new Set())).toMatchObject({allowed:false,creditsToIssue:0});
  const pending=submitManualProof(manual,'private/proofs/p-1.webp');
  expect(pending.stage).toBe('proof_submitted');
  expect(decideCreditGrant(pending,confirmed,new Set()).allowed).toBe(false);
  expect(()=>submitManualProof(manual,'public/p-1.png')).toThrow();
 });
 it('requires admin access and a real bank matched transaction',()=>{
  const record=markUnderReview(submitManualProof(manual,'private/proofs/receipt.webp'),true);
  expect(()=>markUnderReview(record,false)).toThrow();
  expect(decideCreditGrant(record,confirmed,new Set())).toEqual({
    allowed:true,reason:'paid',creditsToIssue:3,payoutReference:'E2E-55',
  });
  expect(decideCreditGrant(record,undefined,new Set()).allowed).toBe(false);
  expect(decideCreditGrant(record,({...confirmed,destinationAccountMatched:false} as never),new Set()).allowed).toBe(false);
  expect(rejectProof(record,true).stage).toBe('rejected');
 });
 it('never grants from screenshot-only paid clicks or duplicate transfer evidence',()=>{
  const record=markUnderReview(submitManualProof(manual,'private/proofs/p.webp'),true);
  expect(decideCreditGrant(record,confirmed,new Set(['E2E-55'])).creditsToIssue).toBe(0);
  expect(decideCreditGrant({...record,stage:'paid',creditGrantId:'grant-1'},confirmed,new Set()).creditsToIssue).toBe(0);
  expect(decideCreditGrant({...record,stage:'refunded'},confirmed,new Set()).creditsToIssue).toBe(0);
 });
 it('requires authenticated matching Asaas payment data; screenshot cannot impersonate webhook',()=>{
  expect(decideCreditGrant(staticQr,asaas,new Set())).toMatchObject({allowed:true,creditsToIssue:3});
  expect(decideCreditGrant(staticQr,({...asaas,webhookAuthenticated:false} as never),new Set()).creditsToIssue).toBe(0);
  expect(decideCreditGrant(staticQr,({...asaas,transactionMatched:false} as never),new Set()).creditsToIssue).toBe(0);
  expect(decideCreditGrant(manual,asaas,new Set()).creditsToIssue).toBe(0);
 });
 it('reserves R$1 exactly and blocks mismatched amount across methods',()=>{
  const record=markUnderReview(submitManualProof(manual,'private/proofs/p.webp'),true);
  expect(decideCreditGrant(record,{...confirmed,receivedAmountCents:99} as never,new Set()).creditsToIssue).toBe(0);
 });
});