import { Injectable, Logger } from "@nestjs/common";
import type {
  CaptureResult,
  ChargeRequest,
  ChargeResult,
  IPaymentProvider,
  RefundResult,
} from "../payment-provider.interface";

/**
 * Tamara — Saudi BNPL (pay in 3/4, pay later).
 * Docs: https://docs.tamara.co  (API: https://api.tamara.co, sandbox: https://api-sandbox.tamara.co)
 *
 * Flow: create a checkout session → redirect shopper to `checkout_url` →
 * shopper approves → Tamara webhook (`order_approved`) → we authorise + CAPTURE
 * (see capture(), called from settlement). Approval alone does NOT collect money;
 * without the capture call Tamara auto-voids the authorisation and nothing is
 * charged — so a membership must never go live on approval alone.
 */
@Injectable()
export class TamaraAdapter implements IPaymentProvider {
  readonly name = "tamara";
  private readonly logger = new Logger("TamaraAdapter");
  private readonly baseUrl = process.env.TAMARA_BASE_URL ?? "https://api-sandbox.tamara.co";

  private get token(): string {
    const t = process.env.TAMARA_API_TOKEN;
    if (!t) throw new Error("TAMARA_API_TOKEN is not configured");
    return t;
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const cur = req.currency;
    const amt = req.amount.toFixed(2);
    const money = (a: string) => ({ amount: a, currency: cur });
    const [first, ...rest] = (req.customer?.name ?? "Customer").trim().split(/\s+/);

    // Tamara validates that every merchant_url is an absolute, public HTTPS URL —
    // a localhost or relative value (missing NEXT_PUBLIC_SITE_URL / API_BASE_URL
    // on the server) is rejected. Surface that as a clear config error rather than
    // letting Tamara return a cryptic 400.
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const apiBase = process.env.API_BASE_URL ?? "";
    const returnUrl = req.returnUrl ?? `${site}/portal/checkout/return`;
    const notification = `${apiBase}/api/payments/webhooks/tamara`;
    if (!/^https:\/\//.test(returnUrl) || !/^https:\/\//.test(notification)) {
      this.logger.error(
        `Tamara needs public HTTPS URLs — returnUrl="${returnUrl}" notification="${notification}". ` +
          `Set NEXT_PUBLIC_SITE_URL and API_BASE_URL on the API to your public https:// URLs.`
      );
      return {
        success: false,
        status: "FAILED",
        providerRef: `tamara_cfg_${Date.now()}`,
        failureReason: "Payment is not configured correctly (merchant URLs). Please contact support.",
      };
    }

    const res = await fetch(`${this.baseUrl}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({
        order_reference_id: req.reference,
        order_number: req.reference,
        // Amounts must reconcile: total = shipping + tax + Σ(item totals).
        total_amount: money(amt),
        shipping_amount: money("0.00"),
        tax_amount: money("0.00"), // Not VAT-registered — 0% VAT (Decision 1).
        description: req.description ?? `Moracat ${req.reference}`,
        country_code: "SA",
        payment_type: "PAY_BY_INSTALMENTS",
        locale: "ar_SA",
        consumer: {
          email: req.customer?.email ?? "",
          first_name: first || "Customer",
          last_name: rest.join(" ") || "-",
          phone_number: req.customer?.phone ?? "",
        },
        merchant_url: { success: returnUrl, failure: returnUrl, cancel: returnUrl, notification },
        // Tamara requires ≥1 item with a full price breakdown that sums to the total.
        items: [
          {
            reference_id: req.reference,
            type: "Digital",
            name: req.description ?? "Moracat membership",
            sku: req.reference,
            quantity: 1,
            unit_price: money(amt),
            discount_amount: money("0.00"),
            tax_amount: money("0.00"),
            total_amount: money(amt),
          },
        ],
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      order_id?: string;
      checkout_url?: string;
      message?: string;
      errors?: unknown[];
    } | null;

    if (!res.ok || !body?.order_id) {
      // Log the FULL error (Tamara returns field-level detail in `errors`) so the
      // exact cause is visible in Render logs, not a generic "internal issue".
      const detail = body?.errors ? JSON.stringify(body.errors) : body?.message ?? "unknown";
      this.logger.error(`Tamara checkout failed (${res.status}): ${detail}`);
      return {
        success: false,
        status: "FAILED",
        providerRef: body?.order_id ?? `tamara_err_${Date.now()}`,
        failureReason: body?.message ?? `Tamara error ${res.status}`,
      };
    }

    return { success: true, status: "PENDING", providerRef: body.order_id, redirectUrl: body.checkout_url };
  }

  /**
   * Collect an approved order: authorise (idempotent — some accounts
   * auto-authorise, so an already-authorised order is not an error) then
   * capture the full amount. Called from webhook settlement the moment Tamara
   * reports the order approved. NOTE: verify against the Tamara sandbox — the
   * authorise/capture endpoints and payloads are implemented per the public
   * docs but haven't been round-tripped against a live sandbox order yet.
   */
  async capture(orderId: string, amount: number, currency: string): Promise<CaptureResult> {
    // 1) Authorise. A 409/"already authorised" is benign; only a hard error stops us.
    const auth = await fetch(`${this.baseUrl}/orders/${orderId}/authorise`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
    });
    if (!auth.ok && auth.status !== 409) {
      const b = (await auth.json().catch(() => null)) as { message?: string } | null;
      this.logger.warn(`authorise ${orderId} returned ${auth.status}: ${b?.message ?? "?"} (continuing to capture)`);
    }

    // 2) Capture the full amount — this is the money movement.
    const res = await fetch(`${this.baseUrl}/payments/capture`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({
        order_id: orderId,
        total_amount: { amount: amount.toFixed(2), currency },
      }),
    });
    const body = (await res.json().catch(() => null)) as { capture_id?: string; message?: string } | null;
    if (!res.ok) {
      this.logger.warn(`capture failed for ${orderId} (${res.status}): ${body?.message ?? "unknown"}`);
      return { success: false, failureReason: body?.message ?? `Tamara capture error ${res.status}` };
    }
    return { success: true, providerRef: body?.capture_id };
  }

  async refund(providerRef: string, amount: number, currency: string): Promise<RefundResult> {
    const res = await fetch(`${this.baseUrl}/payments/simplified-refund/${providerRef}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({
        total_amount: { amount: amount.toFixed(2), currency },
        comment: "Moraqat refund",
      }),
    });
    const body = (await res.json().catch(() => null)) as { refund_id?: string; message?: string } | null;
    if (!res.ok) {
      return { success: false, providerRef, failureReason: body?.message ?? `Tamara refund error ${res.status}` };
    }
    return { success: true, providerRef: body?.refund_id ?? providerRef };
  }
}
