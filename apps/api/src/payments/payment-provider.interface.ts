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
  /**
   * Ask the rail to mint a reusable card token alongside this charge (T7:
   * the member ticked "renew automatically"). Only meaningful on card rails;
   * BNPL ignores it. The token is read back via fetchPayment / the webhook,
   * never from the browser.
   */
  saveCard?: boolean;
}

/**
 * A client-side PSP session (Moyasar Payment Form). The browser collects card
 * details straight into the PSP with the PUBLISHABLE key; our server only ever
 * sees the resulting payment id, which it confirms via fetchPayment. Nothing
 * card-shaped touches our API.
 */
export interface ClientSession {
  kind: "moyasar_form" | "mock_form";
  publishableKey: string;
  /** Smallest unit (halalas). */
  amount: number;
  currency: string;
  /** Our order number — echoed back in the payment's metadata. */
  reference: string;
  description: string;
  callbackUrl: string;
  saveCard: boolean;
  /** Which methods the form should offer for this rail. */
  methods: ("creditcard" | "applepay")[];
}

export interface ChargeResult {
  success: boolean;
  status: "CAPTURED" | "AUTHORIZED" | "PENDING" | "FAILED";
  providerRef: string;
  failureReason?: string;
  /** Present when the shopper must complete payment on the PSP's page. */
  redirectUrl?: string;
  /** Present when the shopper completes payment in an embedded PSP form. */
  clientSession?: ClientSession;
}

/** A stored-credential summary the PSP hands back after a save_card payment. */
export interface StoredCard {
  token: string;
  /** mada | visa | mastercard | … as the PSP names it (lower-case). */
  company: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  holderName: string | null;
  /** creditcard | applepay | … */
  sourceType: string | null;
}

/** The PSP's own view of one payment, read back server-side (attach / reconcile). */
export interface FetchedPayment {
  id: string;
  status: "CAPTURED" | "AUTHORIZED" | "PENDING" | "FAILED" | "REFUNDED";
  /** Smallest unit (halalas). */
  amount: number;
  currency: string;
  /** Our order number as the PSP echoes it back (metadata.reference). */
  reference: string | null;
  card: StoredCard | null;
  failureReason?: string;
  raw?: unknown;
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
  /**
   * Whether this rail can perform a merchant-initiated transaction — a charge
   * with no shopper present, against a stored credential.
   *
   * This is a real capability boundary, not a config toggle: BNPL rails
   * (Tamara, Tabby) underwrite each order individually and cannot be charged
   * off-session, so a membership bought on BNPL can never silently renew. The
   * auto-renew engine reads this to decide between charging and inviting, so
   * the product stays honest about which memberships actually renew themselves.
   */
  readonly supportsRecurring?: boolean;
  charge(req: ChargeRequest): Promise<ChargeResult>;
  /**
   * Charge a stored credential off-session. Only implemented by rails where
   * `supportsRecurring` is true.
   */
  chargeStored?(req: ChargeRequest & { token: string }): Promise<ChargeResult>;
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
  /**
   * Read one payment back from the PSP by its id. Used by the attach step of
   * an embedded-form flow (the browser tells us the id; we trust only what the
   * PSP says about it) and by reconciliation.
   */
  fetchPayment?(providerPaymentId: string): Promise<FetchedPayment | null>;
}

/** Normalized event parsed from a PSP webhook. */
export interface WebhookEvent {
  providerRef: string;
  /**
   * IGNORED is load-bearing. PSPs emit many lifecycle events we take no action
   * on (`payment_authorized`, `created`, `updated`…). These previously fell
   * through a ternary's else-branch to FAILED, which voided the invoice, killed
   * the draft subscription and emailed "your payment didn't go through" while
   * the shopper was still mid-flow — and the genuine success event that
   * followed was then ignored because the payment was no longer PENDING.
   * Unknown or non-actionable events must be an explicit no-op.
   */
  status: "CAPTURED" | "FAILED" | "REFUNDED" | "IGNORED";
  /** Provider-side event identifier, used for replay suppression. */
  eventId?: string;
  /** Which PSP this came from — scopes the replay ledger. */
  provider?: string;
  eventType?: string;
  /**
   * Our order number as echoed by the PSP (metadata.reference). An embedded-form
   * payment is persisted as `pending:<orderNumber>` until we learn the PSP's
   * id, so settlement resolves by reference when the id doesn't match yet.
   */
  reference?: string | null;
  /** Smallest unit; asserted against the order before settling when present. */
  amount?: number | null;
  /** Reusable card the PSP minted for this payment (save_card), if any. */
  card?: StoredCard | null;
  raw?: unknown;
}

export const PAYMENT_PROVIDER_FACTORY = Symbol("PAYMENT_PROVIDER_FACTORY");

export interface IPaymentProviderFactory {
  /** Resolve the adapter responsible for a given provider key. */
  resolve(provider: PaymentProviderKey): IPaymentProvider;
}
