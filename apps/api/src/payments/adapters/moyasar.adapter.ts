import { Injectable, Logger } from "@nestjs/common";
import type {
  ChargeRequest,
  ChargeResult,
  FetchedPayment,
  IPaymentProvider,
  RefundResult,
  StoredCard,
} from "../payment-provider.interface";

/** Rails the embedded Payment Form serves (T7). STC Pay stays on the hosted invoice. */
const FORM_RAILS = new Set(["MADA", "VISA", "MASTERCARD", "APPLE_PAY"]);

/**
 * Moyasar — Saudi PSP handling MADA, Visa/Mastercard, Apple Pay and STC Pay.
 * Docs: https://docs.moyasar.com  (API: https://api.moyasar.com/v1)
 *
 * Two flows:
 *  - Card rails (mada / Visa / Mastercard / Apple Pay) use the **Payment Form**
 *    (moyasar.js, publishable key): the browser posts card details straight to
 *    Moyasar with `save_card` when the member opted into auto-renew, Moyasar
 *    redirects to our callback with `?id=`, and the server confirms the payment
 *    by reading it back (`fetchPayment`). Only a *payment* — never an invoice —
 *    yields the reusable `source.token` a renewal needs (T7, D7).
 *  - Everything else creates an *invoice* (hosted page) and settles by webhook.
 *
 * Works identically in sandbox (test keys `sk_test_...` / `pk_test_...`).
 */
@Injectable()
export class MoyasarAdapter implements IPaymentProvider {
  readonly name = "moyasar";
  /** Card rails support saved-token, off-session charging (see chargeStored). */
  readonly supportsRecurring = true;
  private readonly logger = new Logger("MoyasarAdapter");
  private readonly baseUrl = process.env.MOYASAR_BASE_URL ?? "https://api.moyasar.com/v1";

  private get secretKey(): string {
    const key = process.env.MOYASAR_SECRET_KEY;
    if (!key) throw new Error("MOYASAR_SECRET_KEY is not configured");
    return key;
  }

  private authHeader(): string {
    // Moyasar uses HTTP Basic with the secret key as username, empty password.
    return `Basic ${Buffer.from(`${this.secretKey}:`).toString("base64")}`;
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const publishableKey = process.env.MOYASAR_PUBLISHABLE_KEY;
    if (FORM_RAILS.has(req.provider) && publishableKey && req.returnUrl) {
      // Embedded form: nothing is created server-side yet. The payment row is
      // persisted as `pending:<reference>` and gains Moyasar's id at attach.
      return {
        success: true,
        status: "PENDING",
        providerRef: `pending:${req.reference}`,
        clientSession: {
          kind: "moyasar_form",
          publishableKey,
          amount: Math.round(req.amount * 100),
          currency: req.currency,
          reference: req.reference,
          description: req.description ?? `Moracat ${req.reference}`,
          callbackUrl: req.returnUrl,
          saveCard: !!req.saveCard,
          methods: req.provider === "APPLE_PAY" ? ["applepay"] : ["creditcard"],
        },
      };
    }

    const res = await fetch(`${this.baseUrl}/invoices`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: this.authHeader() },
      body: JSON.stringify({
        // Moyasar amounts are in the smallest unit (halalas).
        amount: Math.round(req.amount * 100),
        currency: req.currency,
        description: req.description ?? `Moraqat ${req.reference}`,
        callback_url: req.returnUrl,
        metadata: { reference: req.reference, provider: req.provider },
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { id?: string; url?: string; status?: string; message?: string }
      | null;

    if (!res.ok || !body?.id) {
      this.logger.warn(`invoice create failed (${res.status}): ${body?.message ?? "unknown"}`);
      return {
        success: false,
        status: "FAILED",
        providerRef: body?.id ?? `moyasar_err_${Date.now()}`,
        failureReason: body?.message ?? `Moyasar error ${res.status}`,
      };
    }

    // Hosted flow: payment completes on Moyasar's page → webhook confirms.
    return {
      success: true,
      status: "PENDING",
      providerRef: body.id,
      redirectUrl: body.url,
    };
  }

  /**
   * Off-session charge against a stored card token, for membership renewals.
   *
   * Unlike `charge` this settles synchronously — there is no shopper to redirect
   * — so the caller gets CAPTURED or FAILED directly rather than waiting on a
   * webhook. A declined renewal must surface as FAILED (never a silent retry),
   * so the dunning ladder can take over and tell the member.
   */
  async chargeStored(req: ChargeRequest & { token: string }): Promise<ChargeResult> {
    const res = await fetch(`${this.baseUrl}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: this.authHeader() },
      body: JSON.stringify({
        amount: Math.round(req.amount * 100),
        currency: req.currency,
        description: req.description ?? `Moraqat ${req.reference}`,
        source: { type: "token", token: req.token },
        metadata: { reference: req.reference, provider: req.provider, recurring: "true" },
      }),
    });

    const body = (await res.json().catch(() => null)) as
      | { id?: string; status?: string; message?: string; source?: { message?: string } }
      | null;

    if (!res.ok || !body?.id) {
      const reason = body?.message ?? body?.source?.message ?? `Moyasar error ${res.status}`;
      this.logger.warn(`stored charge failed (${res.status}): ${reason}`);
      return {
        success: false,
        status: "FAILED",
        providerRef: body?.id ?? `moyasar_err_${Date.now()}`,
        failureReason: reason,
      };
    }

    const paid = body.status === "paid" || body.status === "captured";
    return {
      success: paid,
      status: paid ? "CAPTURED" : "FAILED",
      providerRef: body.id,
      failureReason: paid ? undefined : (body.source?.message ?? body.status ?? "Card declined"),
    };
  }

  /**
   * Read a payment back by id — the only thing we trust after the browser
   * finishes the embedded form. The reference and amount are asserted by the
   * caller against the order before anything settles.
   */
  async fetchPayment(providerPaymentId: string): Promise<FetchedPayment | null> {
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(providerPaymentId)) return null;
    const res = await fetch(`${this.baseUrl}/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: { authorization: this.authHeader() },
    });
    if (res.status === 404) return null;
    const body = (await res.json().catch(() => null)) as MoyasarPayment | null;
    if (!res.ok || !body?.id) {
      this.logger.warn(`fetch payment ${providerPaymentId} failed (${res.status})`);
      return null;
    }
    return normalizeMoyasarPayment(body);
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const res = await fetch(`${this.baseUrl}/payments/${providerRef}/refund`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: this.authHeader() },
      body: JSON.stringify({ amount: Math.round(amount * 100) }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
    if (!res.ok) {
      return {
        success: false,
        providerRef,
        failureReason: body?.message ?? `Moyasar refund error ${res.status}`,
      };
    }
    return { success: true, providerRef: body?.id ?? providerRef };
  }
}

// ── Moyasar payment object → our normalized shape ──────────────────────────

export interface MoyasarPayment {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  description?: string;
  metadata?: Record<string, unknown> | null;
  source?: {
    type?: string;
    company?: string;
    name?: string;
    number?: string;
    month?: string | number;
    year?: string | number;
    token?: string;
    message?: string;
  } | null;
}

export function normalizeMoyasarPayment(p: MoyasarPayment): FetchedPayment {
  const st = String(p.status ?? "").toLowerCase();
  const status: FetchedPayment["status"] =
    st === "paid" || st === "captured"
      ? "CAPTURED"
      : st === "authorized"
        ? "AUTHORIZED"
        : st === "refunded"
          ? "REFUNDED"
          : st === "failed" || st === "voided"
            ? "FAILED"
            : "PENDING";
  const ref = p.metadata && typeof p.metadata.reference === "string" ? p.metadata.reference : null;
  return {
    id: p.id,
    status,
    amount: Number(p.amount ?? 0),
    currency: String(p.currency ?? "SAR"),
    reference: ref,
    card: storedCardOf(p.source),
    failureReason: status === "FAILED" ? (p.source?.message ?? st) : undefined,
    raw: p,
  };
}

/** A reusable token exists only when the payment was made with save_card. */
export function storedCardOf(source: MoyasarPayment["source"]): StoredCard | null {
  if (!source?.token) return null;
  // Moyasar masks the PAN as "XXXX-XXXX-XXXX-1234".
  const digits = String(source.number ?? "").replace(/\D/g, "");
  return {
    token: source.token,
    company: source.company ? String(source.company).toLowerCase() : null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    expMonth: source.month != null && Number.isFinite(Number(source.month)) ? Number(source.month) : null,
    expYear: source.year != null && Number.isFinite(Number(source.year)) ? Number(source.year) : null,
    holderName: source.name ? String(source.name) : null,
    sourceType: source.type ? String(source.type) : null,
  };
}
