import { Injectable, Logger } from "@nestjs/common";
import type {
  ChargeRequest,
  ChargeResult,
  IPaymentProvider,
  RefundResult,
} from "../payment-provider.interface";

/**
 * Tabby — "pay in 4" BNPL, big in KSA/UAE.
 * Docs: https://docs.tabby.ai  (API: https://api.tabby.ai/api/v2)
 *
 * Flow: create a Checkout Session → redirect shopper to `web_url` →
 * Tabby webhook (`authorized`/`closed`) confirms → capture.
 */
@Injectable()
export class TabbyAdapter implements IPaymentProvider {
  readonly name = "tabby";
  private readonly logger = new Logger("TabbyAdapter");
  private readonly baseUrl = process.env.TABBY_BASE_URL ?? "https://api.tabby.ai/api/v2";

  private get secretKey(): string {
    const key = process.env.TABBY_API_KEY;
    if (!key) throw new Error("TABBY_API_KEY is not configured");
    return key;
  }

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const res = await fetch(`${this.baseUrl}/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.secretKey}` },
      body: JSON.stringify({
        payment: {
          amount: req.amount.toFixed(2),
          currency: req.currency,
          description: req.description ?? `Moraqat ${req.reference}`,
          buyer: {
            email: req.customer?.email,
            name: req.customer?.name,
            phone: req.customer?.phone,
          },
          order: { reference_id: req.reference },
        },
        lang: "ar",
        merchant_code: process.env.TABBY_MERCHANT_CODE ?? "moraqat_sa",
        merchant_urls: {
          success: req.returnUrl,
          cancel: req.returnUrl,
          failure: req.returnUrl,
        },
      }),
    });

    const body = (await res.json().catch(() => null)) as {
      id?: string;
      status?: string;
      configuration?: { available_products?: { installments?: { web_url?: string }[] } };
      payment?: { id?: string };
      error?: string;
    } | null;

    const webUrl = body?.configuration?.available_products?.installments?.[0]?.web_url;
    const paymentId = body?.payment?.id ?? body?.id;

    if (!res.ok || !paymentId || body?.status === "rejected") {
      this.logger.warn(`checkout session failed (${res.status}): ${body?.error ?? body?.status}`);
      return {
        success: false,
        status: "FAILED",
        providerRef: paymentId ?? `tabby_err_${Date.now()}`,
        failureReason:
          body?.status === "rejected"
            ? "Tabby rejected this purchase for installments"
            : body?.error ?? `Tabby error ${res.status}`,
      };
    }

    return { success: true, status: "PENDING", providerRef: paymentId, redirectUrl: webUrl };
  }

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    const res = await fetch(`${this.baseUrl.replace("/api/v2", "/api/v1")}/payments/${providerRef}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.secretKey}` },
      body: JSON.stringify({ amount: amount.toFixed(2) }),
    });
    const body = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    if (!res.ok) {
      return { success: false, providerRef, failureReason: body?.error ?? `Tabby refund error ${res.status}` };
    }
    return { success: true, providerRef: body?.id ?? providerRef };
  }
}
