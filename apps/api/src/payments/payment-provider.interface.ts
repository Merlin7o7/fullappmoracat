/**
 * Payment provider abstraction.
 *
 * Two real-world flows are supported:
 *  1. Direct capture   — card/wallet charges that settle synchronously (mock, tokenized cards).
 *  2. Redirect/session — the PSP returns a checkout URL (Tabby, Tamara, hosted Moyasar forms);
 *     the charge completes later via a signed webhook.
 *
 * Adapters are selected by PaymentProviderFactory. PAYMENTS_MODE=mock forces the
 * in-repo sandbox; PAYMENTS_MODE=live routes to a configured adapter per provider
 * and falls back to mock for any provider without credentials (clearly logged).
 */
export type PaymentProviderKey =
  | "MADA"
  | "VISA"
  | "MASTERCARD"
  | "APPLE_PAY"
  | "GOOGLE_PAY"
  | "STC_PAY"
  | "TABBY"
  | "TAMARA"
  | "WALLET"
  | "GIFT_CARD";

export interface ChargeRequest {
  amount: number;
  currency: string;
  provider: PaymentProviderKey;
  reference: string; // our order number
  description?: string;
  customer?: { email?: string; name?: string; phone?: string };
  /** Where the PSP should send the shopper after a hosted/redirect flow. */
  returnUrl?: string;
}

export interface ChargeResult {
  success: boolean;
  status: "CAPTURED" | "AUTHORIZED" | "PENDING" | "FAILED";
  providerRef: string;
  failureReason?: string;
  /** Present when the shopper must complete payment on the PSP's page. */
  redirectUrl?: string;
}

export interface RefundResult {
  success: boolean;
  providerRef: string;
  failureReason?: string;
}

export interface CaptureResult {
  success: boolean;
  /** The provider's capture reference, if it mints a distinct one. */
  providerRef?: string;
  failureReason?: string;
}

export interface IPaymentProvider {
  readonly name: string;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  refund(providerRef: string, amount: number, currency: string): Promise<RefundResult>;
  /**
   * Optional explicit capture. Some rails only *authorise* when the shopper
   * approves (Tamara: order_approved) and require a separate call to actually
   * collect. Providers that capture synchronously (Moyasar invoice, Tabby
   * "closed") omit this — the webhook capture IS the money movement. When
   * present, settlement calls this before marking an order paid, so a
   * membership is never activated against money we haven't collected (R006).
   */
  capture?(
    providerRef: string,
    amount: number,
    currency: string,
    reference?: string
  ): Promise<CaptureResult>;
}

/** Normalized event parsed from a PSP webhook. */
export interface WebhookEvent {
  providerRef: string;
  status: "CAPTURED" | "FAILED" | "REFUNDED";
  raw?: unknown;
}

export const PAYMENT_PROVIDER_FACTORY = Symbol("PAYMENT_PROVIDER_FACTORY");

export interface IPaymentProviderFactory {
  /** Resolve the adapter responsible for a given provider key. */
  resolve(provider: PaymentProviderKey): IPaymentProvider;
}
