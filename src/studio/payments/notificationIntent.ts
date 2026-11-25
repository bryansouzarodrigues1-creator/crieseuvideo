/**
 * Notification OUTBOX INTENTS. This file does not send Push/email/SMS.
 * The business transaction persists a unique event in DB first, then
 * a background worker or Realtime subscription delivers after commit.
 */
export type PaymentNotice=
 |{kind:'proof_received';orderId:string;recipient:'admin';message:string;dedupeKey:string}
 |{kind:'credits_released';orderId:string;recipient:'buyer';credits:3;message:string;dedupeKey:string}
 |{kind:'receipt_rejected';orderId:string;recipient:'buyer';message:string;dedupeKey:string};

function checkedOrderId(id:string):string{
 if(!/^[a-zA-Z0-9_-]{5,128}$/.test(id))throw new Error('Invalid internal order identifier');
 return id;
}
export function proofReceivedNotice(orderId:string):PaymentNotice{
 const id=checkedOrderId(orderId);
 return {kind:'proof_received',orderId:id,recipient:'admin',
  message:'Novo pedido Pix aguardando verificação no extrato bancário.',
  dedupeKey:id+':proof_received'};
}
export function creditsReleasedNotice(orderId:string):PaymentNotice{
 const id=checkedOrderId(orderId);
 return {kind:'credits_released',orderId:id,recipient:'buyer',credits:3,
  message:'Pagamento confirmado! Seus 3 créditos de vídeo 2D estão disponíveis.',
  dedupeKey:id+':credits_released'};
}
export function receiptRejectedNotice(orderId:string):PaymentNotice{
 const id=checkedOrderId(orderId);
 return {kind:'receipt_rejected',orderId:id,recipient:'buyer',
  message:'Não foi possível confirmar seu Pix. Confira o pagamento e fale com o suporte.',
  dedupeKey:id+':receipt_rejected'};
}

/** Caller MUST persist each dedupeKey under UNIQUE before any delivery.
 * Never use a webhook or screenshot to call creditsReleasedNotice
 * until the matching financial verification + DB credit ledger commit.
 */
