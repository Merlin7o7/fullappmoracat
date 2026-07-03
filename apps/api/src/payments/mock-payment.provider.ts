import { Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type {
  ChargeRequest,
  ChargeResult,
  IPaymentProvider,
  RefundResult,
} from "./payment-provider.interface";

/**
 * Development payment provider — approves charges deterministically so the full
 * checkout flow works end-to-end without live PSP credentials.
 * Magic amounts: ending .13 → decline; ending .77 → PENDING + redirect URL
 * (simulates the Tabby/Tamara/hosted-page flow so webhooks are testable).
 */
@Injectable()
export class MockPaymentProvider implements IPaymentProvider {
  readonly name = "mock";
  private readonly logger = new Logger("MockPayments");

  async charge(req: ChargeRequest): Promise<ChargeResult> {
    const cents = Math.round(req.amount * 100) % 100;
    const declined = cents === 13;
    const pending = cents === 77;
    this.logger.log(
      `charge ${req.amount} ${req.currency} via ${req.provider} (${declined ? "DECLINE" : pending ? "PENDING" : "APPROVE"})`
    );
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

  async refund(providerRef: string, amount: number): Promise<RefundResult> {
    this.logger.log(`refund ${amount} for ${providerRef}`);
    return { success: true, providerRef: `mock_refund_${randomUUID()}` };
  }
}
