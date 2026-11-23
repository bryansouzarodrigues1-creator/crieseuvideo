import {describe,it,expect} from 'vitest';
import {evaluateTrial,ENTRY_INCLUDED_VIDEOS,ENTRY_PRICE_BRL_CENTS,ENTRY_MAX_VIDEO_DURATION_SECONDS,type TrialFacts} from './trialPolicy';
const base:TrialFacts={
 authenticated:true,googleIdentityVerified:true,paymentStatus:'paid',
 remainingCredits:3,inFlight:false,turnstileValidatedByServer:true,risk:'low',
 seconds:12,usingReusableMotionLibrary:true,estimatedVariableCostBrlCents:14,
 remainingDailyBudgetBrlCents:100,
};
describe('R$1 entry pack: server-verifiable three-credit policy',()=>{
 it('requires a verified payment, not only a Google login or redirect',()=>{
  expect(ENTRY_PRICE_BRL_CENTS).toBe(100);
  expect(ENTRY_INCLUDED_VIDEOS).toBe(3);
  expect(evaluateTrial(base)).toEqual({allowed:true,reason:'approved'});
  expect(evaluateTrial({...base,paymentStatus:'unpaid'}).reason).toBe('payment_required');
  expect(evaluateTrial({...base,paymentStatus:'pending'}).reason).toBe('payment_required');
  expect(evaluateTrial({...base,paymentStatus:'refunded'}).reason).toBe('payment_reversed');
  expect(evaluateTrial({...base,paymentStatus:'disputed'}).reason).toBe('payment_reversed');
 });
 it('uses exactly 3 credits in a durable ledger, no free fourth video',()=>{
  expect(evaluateTrial({...base,remainingCredits:2}).allowed).toBe(true);
  expect(evaluateTrial({...base,remainingCredits:1}).allowed).toBe(true);
  expect(evaluateTrial({...base,remainingCredits:0}).reason).toBe('out_of_credits');
  expect(evaluateTrial({...base,remainingCredits:4}).reason).toBe('out_of_credits');
 });
 it('rejects parallel dispatch and requires Google identity',()=>{
  expect(evaluateTrial({...base,inFlight:true}).reason).toBe('in_progress');
  expect(evaluateTrial({...base,googleIdentityVerified:false}).reason).toBe('sign_in_google');
  expect(evaluateTrial({...base,authenticated:false}).reason).toBe('sign_in_google');
 });
 it('restricts intro to cheap library-based 2D under 15s',()=>{
  expect(ENTRY_MAX_VIDEO_DURATION_SECONDS).toBe(15);
  expect(evaluateTrial({...base,seconds:16}).reason).toBe('duration_limit');
  expect(evaluateTrial({...base,seconds:2.5}).reason).toBe('duration_limit');
  expect(evaluateTrial({...base,usingReusableMotionLibrary:false}).reason).toBe('library_only');
  expect(evaluateTrial({...base,estimatedVariableCostBrlCents:19}).reason).toBe('budget_exhausted');
  expect(evaluateTrial({...base,remainingDailyBudgetBrlCents:3}).reason).toBe('budget_exhausted');
 });
 it('allows shared IP only as a signal and validates bot challenge server-side',()=>{
  expect(evaluateTrial({...base,risk:'elevated'}).allowed).toBe(true);
  expect(evaluateTrial({...base,risk:'high'}).reason).toBe('security_review');
  expect(evaluateTrial({...base,turnstileValidatedByServer:false}).reason).toBe('verify_human');
 });
});
