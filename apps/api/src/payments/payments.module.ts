import { Global, Module } from "@nestjs/common";
import { PAYMENT_PROVIDER_FACTORY } from "./payment-provider.interface";
import { MockPaymentProvider } from "./mock-payment.provider";
import { MoyasarAdapter } from "./adapters/moyasar.adapter";
import { TabbyAdapter } from "./adapters/tabby.adapter";
import { TamaraAdapter } from "./adapters/tamara.adapter";
import { PaymentProviderFactory } from "./payment-provider.factory";
import { WebhooksController } from "./webhooks.controller";
import { WebhooksService } from "./webhooks.service";
import { RefundsService } from "./refunds.service";

/**
 * Payment infrastructure: adapters (Moyasar / Tabby / Tamara / mock), the
 * provider factory, PSP webhook receivers, and refunds.
 * PAYMENTS_MODE=mock|live — see PaymentProviderFactory for routing rules.
 */
@Global()
@Module({
  controllers: [WebhooksController],
  providers: [
    MockPaymentProvider,
    MoyasarAdapter,
    TabbyAdapter,
    TamaraAdapter,
    WebhooksService,
    RefundsService,
    { provide: PAYMENT_PROVIDER_FACTORY, useClass: PaymentProviderFactory },
  ],
  exports: [PAYMENT_PROVIDER_FACTORY, RefundsService],
})
export class PaymentsModule {}
