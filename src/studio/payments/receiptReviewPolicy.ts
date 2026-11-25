/**
 * PAYMENTS PROTOTYPE — server-side state rules only, not deployed.
 * Screenshots, "Já paguei" clicks and browser notifications are never
 * proof of cleared funds. Verified bank statement or trusted Asaas
 * reconciliation is required before issuing three credits.
 */
export const INTRO_PACK_PRICE_CENTS=100;
export const INTRO_PACK_CREDITS=3;
export type PixCollection='manual_bank_pix'|'asaas_static_qr'|'asaas_dynamic_charge';
export type PaymentStage='waiting_payment'|'proof_submitted'|'reviewing'|'paid'|'rejected'|'refunded';
export type FinancialVerification=
 {type:'manual_bank_statement';adminAuthorized:true;bankTransactionId:string;receivedAmountCents:100;destinationAccountMatched:true}
 |{type:'asaas_verified_event';webhookAuthenticated:true;providerPaymentId:string;receivedAmountCents:100;paymentStatus:'RECEIVED'|'CONFIRMED';transactionMatched:true};
export type PaymentRecord={
 orderId:string;userId:string;method:PixCollection;stage:PaymentStage;
 proofObjectPath?:string;
 payoutReference?:string;
 creditGrantId?:string;
};

export function submitManualProof(
 record:PaymentRecord,proofObjectPath:string
):PaymentRecord{
 if(record.method!=='manual_bank_pix'||record.stage!=='waiting_payment')throw new Error('Pagamento não aguarda comprovante.');
 if(!proofObjectPath.startsWith('private/'))throw new Error('Comprovante deve estar em armazenamento privado.');
 return {...record,stage:'proof_submitted',proofObjectPath};
}
export function markUnderReview(record:PaymentRecord,adminAuthorized:boolean):PaymentRecord{
 if(!adminAuthorized)throw new Error('Sem acesso administrativo.');
 if(record.stage!=='proof_submitted')throw new Error('Não há comprovante pendente.');
 return {...record,stage:'reviewing'};
}
export function rejectProof(record:PaymentRecord,adminAuthorized:boolean):PaymentRecord{
 if(!adminAuthorized)throw new Error('Sem acesso administrativo.');
 if(record.stage!=='reviewing')throw new Error('Não está em análise.');
 return {...record,stage:'rejected'};
}
export type GrantDecision={
  allowed:boolean;
  reason:'paid'|'not_verified'|'invalid_amount'|'method_mismatch'|'already_granted';
  creditsToIssue:0|3;
  payoutReference?:string;
};
export function decideCreditGrant(
 record:PaymentRecord,verification:FinancialVerification|undefined,
 alreadySeenReferences:ReadonlySet<string>
):GrantDecision{
 const fail=(reason:GrantDecision['reason']):GrantDecision=>({allowed:false,reason,creditsToIssue:0});
 if(!verification)return fail('not_verified');
 if(record.stage==='paid'||record.creditGrantId)return fail('already_granted');
 if(record.stage==='rejected'||record.stage==='refunded')return fail('not_verified');
 if(verification.receivedAmountCents!==INTRO_PACK_PRICE_CENTS)return fail('invalid_amount');
 const manual=verification.type==='manual_bank_statement';
 const reference=manual?verification.bankTransactionId:verification.providerPaymentId;
 if(!reference||alreadySeenReferences.has(reference))return fail('already_granted');
 if(manual){
  if(record.method!=='manual_bank_pix'||record.stage!=='reviewing'||
      !verification.adminAuthorized||!verification.destinationAccountMatched)
    return fail('method_mismatch');
 }else{
  if(record.method==='manual_bank_pix'||!verification.webhookAuthenticated||
     !verification.transactionMatched)
    return fail('method_mismatch');
 }
 return {allowed:true,reason:'paid',creditsToIssue:INTRO_PACK_CREDITS,payoutReference:reference};
}

/**
 * IMPORTANT: a positive decision is NOT a credit write.
 * Persist payment verification, unique provider/bank reference and
 * the 3-credit grant in one database transaction, then notify the user.
 * Trusted Asaas event auth requires the dedicated asaas-access-token
 * webhook secret, plus provider payment reconciliation and idempotency.
 */
