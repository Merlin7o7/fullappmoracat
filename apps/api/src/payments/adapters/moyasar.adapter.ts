import { Injectable, Logger } from "@nestjs/common";
import type {
  ChargeRequest,
  ChargeResult,
  IPaymentProvider,
  RefundResult,
} from "../payment-provider.interface";

/**
 * Moyasar — Saudi PSP handling MADA, Visa/Mastercard, Apple Pay and STC Pay.
 * Docs: https://docs.moyasar.com  (API: https://api.moyasar.com/v1)
 *
 * Server-side we create an *invoice* (hosted payment page): the shopper is
 * redirected to `url`, pays with Mada/Apple Pay/STC Pay, and Moyasar calls our
 * webhook. Works identically in sandbox (test keys `sk_test_...`).
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
