/**
 * Free-trial admission policy — pure server-side decision model.
 * This file DOES NOT authorize API calls. Enforce a unique user credit
 * with an atomic database insert before invoking any paid model.
 * All flags here must come from verified server facts, never client JSON.
 */
export const FREE_TRIAL_DURATION_SECONDS = 20;
export const FREE_TRIAL_MAX_COST_USD_CENTS = 30;

export type TrialState='none'|'reserved'|'dispatched'|'completed'|'unknown';
export type RiskLevel='low'|'elevated'|'high';
export type TrialReason=
  |'sign_in_google'|'already_used'|'in_progress'|'security_review'
  |'verify_human'|'duration_limit'|'budget_exhausted'|'approved';

export type TrialFacts={
  authenticated:boolean;
  googleIdentityVerified:boolean; // checked from Supabase auth identities/app_metadata on SERVER
  trialState:TrialState; // fetched from durable Postgres, not localStorage
  turnstileValidatedByServer:boolean;
  risk:RiskLevel; // IP/device are merely signals, never sole hard bans
  seconds:number;
  dailyBudgetRemainingUsdCents:number;
  estimateUsdCents:number;
};

export function evaluateTrial(facts:TrialFacts):{allowed:boolean;reason:TrialReason}{
  if(!facts.authenticated||!facts.googleIdentityVerified)
    return {allowed:false,reason:'sign_in_google'};
  if(facts.trialState==='completed')
    return {allowed:false,reason:'already_used'};
  if(facts.trialState!=='none')
    return {allowed:false,reason:'in_progress'};
  if(!Number.isInteger(facts.seconds)||facts.seconds<1||
      facts.seconds>FREE_TRIAL_DURATION_SECONDS)
    return {allowed:false,reason:'duration_limit'};
  if(facts.risk==='high')
    return {allowed:false,reason:'security_review'};
  if(!facts.turnstileValidatedByServer)
    return {allowed:false,reason:'verify_human'};
  if(!Number.isFinite(facts.estimateUsdCents)||
     facts.estimateUsdCents<0||
     facts.estimateUsdCents>FREE_TRIAL_MAX_COST_USD_CENTS||
     facts.dailyBudgetRemainingUsdCents<facts.estimateUsdCents)
    return {allowed:false,reason:'budget_exhausted'};
  // Elevated risk (e.g. shared network) is NOT an automatic block.
  return {allowed:true,reason:'approved'};
}
