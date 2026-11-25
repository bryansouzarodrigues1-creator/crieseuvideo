/**
 * Provider status is fetched server-side from Asaas. Webhook bodies alone,
 * screenshots and browser-submitted "paid" flags must never mint credits.
 */
export type VerifiedAsaasPayment = {
  id: string;
  status: string;
  billingType: string;
  value: number;
  pixQrCodeId?: string | null;
};
export type ServerPaymentOrder = {
  provider_qr_id: string | null;
  amount_cents: number;
  state: string;
};
export function matchesReceivedStaticPix(
  payment: VerifiedAsaasPayment,
  order: ServerPaymentOrder,
): boolean {
  if (order.state !== 'pending' || !order.provider_qr_id) return false;
  if (!/^pay_[A-Za-z0-9_-]{4,100}$/.test(payment.id)) return false;
  return payment.status === 'RECEIVED' &&
    payment.billingType === 'PIX' &&
    payment.pixQrCodeId === order.provider_qr_id &&
    Number.isFinite(payment.value) &&
    Math.round(payment.value * 100) === order.amount_cents &&
    Math.abs(payment.value * 100 - order.amount_cents) < 0.000001;
}
