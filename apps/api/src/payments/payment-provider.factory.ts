import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import {
  type IPaymentProvider,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
} from "./payment-provider.interface";
import { MockPaymentProvider } from "./mock-payment.provider";
import { MoyasarAdapter } from "./adapters/moyasar.adapter";
import { TabbyAdapter } from "./adapters/tabby.adapter";
import { TamaraAdapter } from "./adapters/tamara.adapter";

/**
 * Routes each provider key to its adapter.
 *
 *   PAYMENTS_MODE=mock  → everything uses the mock (default for dev).
 *   PAYMENTS_MODE=live  → route per provider *if credentials exist*. If an external
 *                         rail is unconfigured we REFUSE and throw 503 — never fall
 *                         back to the mock, which approves charges (a misconfigured
 *                         prod would activate memberships with zero money moved).
 *
 * Card rails (MADA/VISA/MC/APPLE_PAY/STC_PAY) run through Moyasar; the BNPLs
 * have their own adapters. WALLET/GIFT_CARD settle internally → mock.
 */
@Injectable()
export class PaymentProviderFactory implements IPaymentProviderFactory {
  private readonly logger = new Logger("PaymentFactory");

  constructor(
    private readonly mock: MockPaymentProvider,
    private readonly moyasar: MoyasarAdapter,
    private readonly tabby: TabbyAdapter,
    private readonly tamara: TamaraAdapter
  ) {}

  resolve(provider: PaymentProviderKey): IPaymentProvider {
    if ((process.env.PAYMENTS_MODE ?? "mock") !== "live") return this.mock;

    const pick = (adapter: IPaymentProvider, configured: boolean): IPaymentProvider => {
      if (configured) return adapter;
      // In live mode an unconfigured external rail must FAIL LOUDLY. Falling back
      // to the mock — which approves charges — would tell members "membership
      // active, receipt on the way" while zero money moved and the Cat ID
      // activates (Blocker #2, R006/R118). A 503 surfaces as the checkout's
      // dignified "payment didn't go through — nothing was charged" retry, and
      // pages the team instead of silently faking revenue.
      this.logger.error(
        `${provider}: ${adapter.name} not configured in live mode — refusing mock fallback`
      );
      throw new ServiceUnavailableException(`Payment provider for ${provider} is not configured`);
    };

    switch (provider) {
      case "MADA":
      case "VISA":
      case "MASTERCARD":
      case "APPLE_PAY":
      case "GOOGLE_PAY":
      case "STC_PAY":
        return pick(this.moyasar, !!process.env.MOYASAR_SECRET_KEY);
      case "TABBY":
        return pick(this.tabby, !!process.env.TABBY_API_KEY);
      case "TAMARA":
        return pick(this.tamara, !!process.env.TAMARA_API_TOKEN);
      case "WALLET":
      case "GIFT_CARD":
      default:
        return this.mock;
    }
  }
}
