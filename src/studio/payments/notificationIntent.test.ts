import {describe,it,expect} from 'vitest';
import {proofReceivedNotice,creditsReleasedNotice,receiptRejectedNotice} from './notificationIntent';
describe('payment notifications are event intentions, not immediate delivery',()=>{
 it('notifies admin of submitted proof without granting anything',()=>{
  expect(proofReceivedNotice('order_123')).toMatchObject({
    kind:'proof_received',recipient:'admin',dedupeKey:'order_123:proof_received'
  });
  expect('credits' in proofReceivedNotice('order_123')).toBe(false);
 });
 it('notifies buyer after a verified three-credit commit',()=>{
  expect(creditsReleasedNotice('order_123')).toMatchObject({
    kind:'credits_released',recipient:'buyer',credits:3
  });
  expect(receiptRejectedNotice('order_123')).toMatchObject({kind:'receipt_rejected',recipient:'buyer'});
 });
 it('dedupe keys are deterministic and reject unsafe IDs',()=>{
  expect(proofReceivedNotice('order_123').dedupeKey).toEqual(proofReceivedNotice('order_123').dedupeKey);
  expect(()=>proofReceivedNotice('../bad')).toThrow();
 });
});