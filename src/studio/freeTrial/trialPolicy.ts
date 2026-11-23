/**
 * R$ 1 ENTRY PACK: 3 basic 2D videos, not a free trial.
 *
 * This function is a PURE POLICY. It neither accepts a Pix payment nor
 * issues credits. All facts must originate in verified server records.
 * Atomic credit reservations and provider dispatch need a SQL transaction.
 */
export const ENTRY_PRICE_BRL_CENTS=100;
export const ENTRY_INCLUDED_VIDEOS=3;
export const ENTRY_MAX_VIDEO_DURATION_SECONDS=15;
/** Provisional HARD cost ceiling, must be measured before sales are enabled. */
export const ENTRY_MAX_VIDEO_VARIABLE_COST_BRL_CENTS=18;
export type RiskLevel='low'|'elevated'|'high';
export type PaymentStatus='unpaid'|'pending'|'paid'|'refunded'|'disputed';
export type AdmissionReason=
 'sign_in_google'|'payment_required'|'payment_reversed'|'out_of_credits'|
 'in_progress'|'security_review'|'verify_human'|'duration_limit'|
 'library_only'|'budget_exhausted'|'approved';

export type TrialFacts={
 authenticated:boolean;
 googleIdentityVerified:boolean;
 paymentStatus:PaymentStatus; // verified provider webhook and durable server order
 remainingCredits:number; // durable count (0..3) after any active reservation
 inFlight:boolean; // durable reservation/dispatch state, NOT in-memory Map
 turnstileValidatedByServer:boolean;
 risk:RiskLevel;
 seconds:number;
 usingReusableMotionLibrary:boolean;
 estimatedVariableCostBrlCents:number;
 remainingDailyBudgetBrlCents:number;
};
export function evaluateTrial(facts:TrialFacts):{allowed:boolean;reason:AdmissionReason}{
 if(!facts.authenticated||!facts.googleIdentityVerified)
  return {allowed:false,reason:'sign_in_google'};
 if(facts.paymentStatus==='refunded'||facts.paymentStatus==='disputed')
  return {allowed:false,reason:'payment_reversed'};
 if(facts.paymentStatus!=='paid')
  return {allowed:false,reason:'payment_required'};
 if(!Number.isInteger(facts.remainingCredits)||facts.remainingCredits<=0||
    facts.remainingCredits>ENTRY_INCLUDED_VIDEOS)
  return {allowed:false,reason:'out_of_credits'};
 if(facts.inFlight)return {allowed:false,reason:'in_progress'};
 if(!Number.isInteger(facts.seconds)||facts.seconds<1||
   facts.seconds>ENTRY_MAX_VIDEO_DURATION_SECONDS)
  return {allowed:false,reason:'duration_limit'};
 if(!facts.usingReusableMotionLibrary)
  return {allowed:false,reason:'library_only'};
 if(facts.risk==='high')return {allowed:false,reason:'security_review'};
 if(!facts.turnstileValidatedByServer)
  return {allowed:false,reason:'verify_human'};
 if(!Number.isFinite(facts.estimatedVariableCostBrlCents)||
    facts.estimatedVariableCostBrlCents<0||
    facts.estimatedVariableCostBrlCents>ENTRY_MAX_VIDEO_VARIABLE_COST_BRL_CENTS||
    facts.remainingDailyBudgetBrlCents<facts.estimatedVariableCostBrlCents)
  return {allowed:false,reason:'budget_exhausted'};
 // Elevated risk (IP or device used by multiple people) is no auto-ban.
 return {allowed:true,reason:'approved'};
}
