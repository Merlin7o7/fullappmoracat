import { Injectable, Logger } from "@nestjs/common";
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
 *   PAYMENTS_MODE=live  → route per provider *if credentials exist*, else fall
 *                         back to mock with a loud warning (never crash checkout).
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
      this.logger.warn(`${provider}: ${adapter.name} not configured — falling back to mock`);
      return this.mock;
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
