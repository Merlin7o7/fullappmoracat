import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { commerceEnabled } from "../common/config/features";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
} from "./payment-provider.interface";

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly factory: IPaymentProviderFactory
  ) {}

  /** Full or partial refund of an order's captured payment (admin action). */
  async refundOrder(actorId: string, orderNumber: string, amount?: number, reason?: string) {
    // Fail closed at the service boundary too — never rely solely on the
    // @Commercial route decorator (CommerceGuard is default-allow/opt-in).
    if (!commerceEnabled()) {
      throw new ForbiddenException({ code: "MEMBERSHIPS_COMING_SOON", message: "Payments are disabled." });
    }
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: { payments: { orderBy: { createdAt: "desc" } }, invoice: true },
    });
    if (!order) throw new NotFoundException("Order not found");

    const payment = order.payments.find((p) => p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED");
    if (!payment?.providerRef) {
      throw new BadRequestException("Order has no captured payment to refund");
    }

    const alreadyRefunded = await this.prisma.refund.aggregate({
      _sum: { amount: true },
      where: { paymentId: payment.id },
    });
    const refundedSoFar = Number(alreadyRefunded._sum.amount ?? 0);
    const captured = Number(payment.amount);
    const refundable = round(captured - refundedSoFar);
    const toRefund = amount != null ? round(amount) : refundable;

    if (toRefund <= 0 || toRefund > refundable) {
      throw new BadRequestException(
        `Refund must be between 0.01 and ${refundable} ${order.currency}`
      );
    }

    // Ask the PSP first — never record a refund we didn't execute.
    const adapter = this.factory.resolve(payment.provider);
    const result = await adapter.refund(payment.providerRef, toRefund, order.currency);
    if (!result.success) {
      throw new BadRequestException(result.failureReason ?? "PSP refund failed");
    }

    const fullyRefunded = round(refundedSoFar + toRefund) >= captured;

    await this.prisma.$transaction([
      this.prisma.refund.create({
        data: {
          paymentId: payment.id,
          amount: new Prisma.Decimal(toRefund),
          reason,
          providerRef: result.providerRef,
        },
      }),
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: fullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      }),
      ...(fullyRefunded
        ? [
            this.prisma.order.update({ where: { id: order.id }, data: { status: "RETURNED" } }),
            this.prisma.invoice.updateMany({
              where: { orderId: order.id },
              data: { status: "REFUNDED" },
            }),
          ]
        : []),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "order.refund",
          entityType: "Order",
          entityId: order.id,
          metadata: { amount: toRefund, reason: reason ?? null, providerRef: result.providerRef },
        },
      }),
    ]);

    return {
      orderNumber,
      refunded: toRefund,
      totalRefunded: round(refundedSoFar + toRefund),
      fullyRefunded,
      currency: order.currency,
      providerRef: result.providerRef,
    };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
