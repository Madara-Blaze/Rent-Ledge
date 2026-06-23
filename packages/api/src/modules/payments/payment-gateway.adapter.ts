/**
 * Payment-gateway port. Every external integration (Razorpay/Stripe-style) sits
 * behind this interface so the system runs end-to-end with the mock and no live
 * credentials. Swap the provider in PaymentsModule to go live.
 */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface GatewayChargeRequest {
  amountMinor: bigint;
  currency: string;
  reference?: string;
  tenancyId: string;
}

export interface GatewayChargeResult {
  gatewayPaymentId: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
}

export interface GatewayWebhookEvent {
  /** Provider event id — used as the idempotency key so duplicates dedupe. */
  id: string;
  type: string;
  gatewayPaymentId: string;
  amountMinor: string;
  currency: string;
  status: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  tenancyId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentGateway {
  readonly name: string;
  createCharge(req: GatewayChargeRequest): Promise<GatewayChargeResult>;
  /** Validate signature + parse. Throws if the payload is invalid. */
  verifyWebhook(rawBody: string, signature?: string): GatewayWebhookEvent;
}
