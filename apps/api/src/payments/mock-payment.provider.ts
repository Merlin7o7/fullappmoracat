import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ChargeRequest,
  ChargeResult,
  FetchedPayment,
  IPaymentProvider,
  RefundResult,
} from "./payment-provider.interface";

/** Card rails that would use the embedded Payment Form in live mode. */
const FORM_RAILS = new Set(["MADA", "VISA", "MASTERCARD", "APPLE_PAY"]);

/**
 * Development payment provider — approves charges deterministically so the full
 * checkout flow works end-to-end without live PSP credentials.
 * Magic amounts: ending .13 → decline; ending .77 → PENDING + redirect URL
 * (simulates the Tabby/Tamara/hosted-page flow so webhooks are testable).
 * A card charge with `saveCard` opens a mock *form session* (T7): the client
 * "completes" it by attaching `mockpay_<reference>`, and fetchPayment returns a
 * paid payment carrying a reusable token — the same shape Moyasar produces.
 */
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = "mock";
  /** So the renewal engine is exercisable end-to-end in dev and e2e. */
  readonly supportsRecurring = true;
  private readonly logger = new Logger("MockPayments");
  /** Sessions opened by charge(), so fetchPayment can echo amount + currency. */
  private readonly sessions = new Map<string, { amount: number; currency: string; provider: string }>();

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const cents = Math.round(req.amount * 100) % 100;
    const declined = cents === 13;
    const pending = cents === 77;
    this.logger.log(
      `charge ${req.amount} ${req.currency} via ${req.provider} (${declined ? "DECLINE" : pending ? "PENDING" : "APPROVE"})`
    );
    if (!declined && !pending && req.saveCard && FORM_RAILS.has(req.provider) && req.returnUrl) {
      this.sessions.set(req.reference, { amount: Math.round(req.amount * 100), currency: req.currency, provider: req.provider });
      return {
        success: true,
        status: "PENDING",
        providerRef: `pending:${req.reference}`,
        clientSession: {
          kind: "mock_form",
          publishableKey: "pk_test_mock",
          amount: Math.round(req.amount * 100),
          currency: req.currency,
          reference: req.reference,
          description: req.description ?? `Moracat ${req.reference}`,
          callbackUrl: req.returnUrl,
          saveCard: true,
          methods: req.provider === "APPLE_PAY" ? ["applepay"] : ["creditcard"],
        },
      };
    }
    if (declined) {
      return {
        success: false,
        status: "FAILED",
        providerRef: `mock_${randomUUID()}`,
        failureReason: "Card declined (mock)",
      };
    }
    if (pending) {
      const ref = `mock_${randomUUID()}`;
      return {
        success: true,
        status: "PENDING",
        providerRef: ref,
        redirectUrl: `https://checkout.mock.moraqat.sa/${ref}`,
      };
    }
    return { success: true, status: "CAPTURED", providerRef: `mock_${randomUUID()}` };
  }

  /**
   * Off-session renewal charge. Settles synchronously like a real card rail:
   * a renewal never redirects, because there is no shopper present.
   * The .13 decline convention is preserved so dunning is testable.
   */
  async chargeStored(req: ChargeRequest & { token: string }): Promise<ChargeResult> {
    const cents = Math.round(req.amount * 100) % 100;
    if (cents === 13 || req.token === "tok_declined") {
      return {
        success: false,
        status: "FAILED",
        providerRef: `mock_${randomUUID()}`,
        failureReason: "Card declined (mock)",
      };
    }
    this.logger.log(`stored charge ${req.amount} ${req.currency} for ${req.reference}`);
    return { success: true, status: "CAPTURED", providerRef: `mock_${randomUUID()}` };
  }

  /**
   * `mockpay_<reference>` reads back as a paid card payment with a fresh token
   * (brand mada, last4 from the reference) — enough for settle() to store the
   * card and arm auto-renew. `mockpay_declined_<reference>` reads back FAILED.
   */
  async fetchPayment(providerPaymentId: string): Promise<FetchedPayment | null> {
    const m = /^mockpay_(declined_)?(.+)$/.exec(providerPaymentId);
    if (!m) return null;
    const reference = m[2]!;
    const session = this.sessions.get(reference);
    const failed = !!m[1];
    return {
      id: providerPaymentId,
      status: failed ? "FAILED" : "CAPTURED",
      amount: session?.amount ?? 0,
      currency: session?.currency ?? "SAR",
      reference,
      card: failed
        ? null
        : {
            token: `tok_mock_${randomUUID().slice(0, 12)}`,
            company: session?.provider === "VISA" ? "visa" : session?.provider === "MASTERCARD" ? "mastercard" : "mada",
            last4: reference.replace(/\D/g, "").slice(-4).padStart(4, "0"),
            expMonth: 12,
            expYear: new Date().getFullYear() + 3,
            holderName: null,
            sourceType: session?.provider === "APPLE_PAY" ? "applepay" : "creditcard",
          },
      failureReason: failed ? "Card declined (mock)" : undefined,
    };
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    this.logger.log(`refund ${amount} for ${providerRef}`);
    return { success: true, providerRef: `mock_refund_${randomUUID()}` };
  }
}
