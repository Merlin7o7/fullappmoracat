import { Injectable, Logger } from "@nestjs/common";
import type {
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
 * Tamara webhook (`order_approved`) → capture.
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
    const res = await fetch(`${this.baseUrl}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.token}` },
      body: JSON.stringify({
        order_reference_id: req.reference,
        total_amount: { amount: req.amount.toFixed(2), currency: req.currency },
        description: req.description ?? `Moraqat ${req.reference}`,
        country_code: "SA",
        payment_type: "PAY_BY_INSTALMENTS",
        locale: "ar_SA",
        consumer: {
          email: req.customer?.email,
          first_name: req.customer?.name?.split(" ")[0] ?? "Customer",
          last_name: req.customer?.name?.split(" ").slice(1).join(" ") || "-",
          phone_number: req.customer?.phone,
        },
        merchant_url: {
          success: req.returnUrl,
          failure: req.returnUrl,
          cancel: req.returnUrl,
          notification: `${process.env.API_BASE_URL ?? ""}/api/payments/webhooks/tamara`,
        },
        // Tamara requires at least one item; a subscription box is one line.
        items: [
          {
            reference_id: req.reference,
            type: "Physical",
            name: req.description ?? "Moraqat box",
            sku: req.reference,
            quantity: 1,
            total_amount: { amount: req.amount.toFixed(2), currency: req.currency },
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
      this.logger.warn(`checkout failed (${res.status}): ${body?.message ?? "unknown"}`);
      return {
        success: false,
        status: "FAILED",
        providerRef: body?.order_id ?? `tamara_err_${Date.now()}`,
        failureReason: body?.message ?? `Tamara error ${res.status}`,
      };
    }

    return { success: true, status: "PENDING", providerRef: body.order_id, redirectUrl: body.checkout_url };
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
