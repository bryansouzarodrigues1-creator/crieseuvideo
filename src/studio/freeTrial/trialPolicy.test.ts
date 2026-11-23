import {describe,it,expect} from 'vitest';
import {evaluateTrial,FREE_TRIAL_DURATION_SECONDS,type TrialFacts} from './trialPolicy';

const base:TrialFacts={
 authenticated:true,googleIdentityVerified:true,trialState:'none',
 turnstileValidatedByServer:true,risk:'low',seconds:15,
 dailyBudgetRemainingUsdCents:400,estimateUsdCents:10,
};
describe('one free video: admission decisions',()=>{
 it('allows a verified Google user with clean record and budget',()=>{
  expect(evaluateTrial(base)).toEqual({allowed:true,reason:'approved'});
 });
 it('requires Google and never trusts a session alone',()=>{
  expect(evaluateTrial({...base,authenticated:false}).reason).toBe('sign_in_google');
  expect(evaluateTrial({...base,googleIdentityVerified:false}).reason).toBe('sign_in_google');
 });
 it('rejects second free video for the same durable user ID',()=>{
  expect(evaluateTrial({...base,trialState:'completed'}).reason).toBe('already_used');
 });
 it('does not allow another request during a reserved or ambiguous dispatch',()=>{
  for(const trialState of ['reserved','dispatched','unknown'] as const)
   expect(evaluateTrial({...base,trialState}).reason).toBe('in_progress');
 });
 it('enforces preview length and separate budget cap',()=>{
  expect(FREE_TRIAL_DURATION_SECONDS).toBe(20);
  expect(evaluateTrial({...base,seconds:21}).reason).toBe('duration_limit');
  expect(evaluateTrial({...base,seconds:0}).reason).toBe('duration_limit');
  expect(evaluateTrial({...base,seconds:20.5}).reason).toBe('duration_limit');
  expect(evaluateTrial({...base,dailyBudgetRemainingUsdCents:5}).reason).toBe('budget_exhausted');
  expect(evaluateTrial({...base,estimateUsdCents:31}).reason).toBe('budget_exhausted');
  expect(evaluateTrial({...base,estimateUsdCents:NaN}).reason).toBe('budget_exhausted');
 });
 it('requires server-verified antibot challenge',()=>{
  expect(evaluateTrial({...base,turnstileValidatedByServer:false}).reason).toBe('verify_human');
 });
 it('does not punish families, offices or mobile subscribers sharing IP addresses',()=>{
  expect(evaluateTrial({...base,risk:'elevated'}).allowed).toBe(true);
  expect(evaluateTrial({...base,risk:'high'}).reason).toBe('security_review');
 });
});
