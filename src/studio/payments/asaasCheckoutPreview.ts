/**
 * Asaas payment request builders (NO networking, NO keys, NO charges).
 * This is a preview-only integration for PR #107; production requests
 * are forbidden until a new non-exposed secret, sandbox, webhook and
 * durable credit ledger have been tested.
 *
 * Values are defined by server-approved SKUs. The browser must never
 * supply an arbitrary price, customer credit count or paid status.
 */
import {getPlan,type PricingTierId} from '../pricing/catalog';

export type AsaasEnvironment='sandbox'|'production';
export const ASAAS_BASE_URL={
 sandbox:'https://api-sandbox.asaas.com/v3',
 production:'https://api.asaas.com/v3'
} as const;

export const STATIC_PIX_ENDPOINT='/pix/qrCodes/static' as const;
export const DYNAMIC_PIX_ENDPOINT='/payments' as const;
export type AsaasRequestPreview<T>={
 endpoint:typeof STATIC_PIX_ENDPOINT|typeof DYNAMIC_PIX_ENDPOINT;
 method:'POST';
 payload:T;
};

function validateOrderId(orderId:string):string{
 if(!/^[A-Za-z0-9_-]{5,80}$/.test(orderId))
  throw new Error('Referência de pedido inválida.');
 return orderId;
}
function amountForServerSku(sku:PricingTierId){
 const plan=getPlan(sku);
 if(!Number.isSafeInteger(plan.priceCents)||plan.priceCents<100)
  throw new Error('Valor do plano inválido para a prévia de pagamento.');
 return {value:plan.priceCents/100,credits:plan.credits};
}
export type StaticPixPayload={
 addressKey:string;
 value:number;
 description:string;
 format:'ALL';
 allowsMultiplePayments:false;
 externalReference:string;
 expirationSeconds:900;
};
export type DynamicPixPayload={
 customer:string;
 billingType:'PIX';
 value:number;
 dueDate:string;
 description:string;
 externalReference:string;
};

/**
 * Recommended when account's free static Pix allowance and reconciliation
 * have been verified. addressKey must be read from secure server config,
 * not supplied by the browser or committed to a repository.
 */
export function previewStaticPix(
 sku:PricingTierId,orderId:string,addressKey:string
):AsaasRequestPreview<StaticPixPayload>{
 const ref=validateOrderId(orderId);
 if(typeof addressKey!=='string'||!addressKey.trim()||addressKey.length>140)
  throw new Error('Chave Pix não está configurada no servidor.');
 return {
  endpoint:STATIC_PIX_ENDPOINT,method:'POST',
  payload:{addressKey,value:amountForServerSku(sku).value,
   description:'CrieSeuVideo - '+sku,format:'ALL',
   allowsMultiplePayments:false,externalReference:ref,
   expirationSeconds:900}
 };
}

/** Alternate billing route if static QR is not viable on this Asaas account. */
export function previewDynamicPix(
 sku:PricingTierId,orderId:string,customerId:string,dueDate:string
):AsaasRequestPreview<DynamicPixPayload>{
 const ref=validateOrderId(orderId);
 if(!/^cus_[A-Za-z0-9]+$/.test(customerId))
  throw new Error('Cliente Asaas inválido.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)||
    !Number.isFinite(Date.parse(dueDate+'T00:00:00Z')))
  throw new Error('Data de vencimento inválida.');
 return {endpoint:DYNAMIC_PIX_ENDPOINT,method:'POST',payload:{
  customer:customerId,billingType:'PIX',
  value:amountForServerSku(sku).value,dueDate,
  description:'CrieSeuVideo - '+sku,externalReference:ref
 }};
}

/**
 * Webhook review is deliberately NOT implemented here. An authenticated
 * provider event is insufficient until payment amount, paid state and
 * matching externalReference/pixQrCodeId are reconciled with the DB order.
 * A 3-credit grant must be an idempotent DB transaction.
 */
