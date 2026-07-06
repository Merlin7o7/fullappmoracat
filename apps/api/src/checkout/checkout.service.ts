import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { CartService } from "../cart/cart.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { orderConfirmationTemplate, paymentReceiptTemplate } from "../mail/mail.templates";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
} from "../payments/payment-provider.interface";
import type { CheckoutDto } from "./dto/checkout.dto";
import { commerceEnabled } from "../common/config/features";

/** KSA standard VAT — prices are VAT-inclusive; the invoice breaks it out. */
const VAT_RATE = 0.15;

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  async checkout(userId: string, dto: CheckoutDto) {
    // Defense-in-depth behind the route-level @Commercial guard: even an
    // internal caller can never move money while Community Mode is active.
    if (!commerceEnabled()) {
      throw new HttpException(
        { code: "MEMBERSHIPS_COMING_SOON", message: "Checkout is not available yet." },
        HttpStatus.FORBIDDEN
      );
    }

    const cart = await this.cart.get(dto.cartId); // throws if missing
    if (cart.items.length === 0) throw new BadRequestException("Cart is empty");

    if (dto.addressId) {
      const owns = await this.prisma.address.findFirst({
        where: { id: dto.addressId, userId },
        select: { id: true },
      });
      if (!owns) throw new BadRequestException("Address does not belong to you");
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true },
    });

    const { subtotal, discountTotal, shippingTotal, grandTotal } = cart.totals;
    const orderNumber = makeNumber("MRQ");

    // 1) Charge (or open a PSP session) first — never persist an order we
    //    didn't at least initiate collection for.
    const adapter = this.payments.resolve(dto.provider as PaymentProviderKey);
    const charge = await adapter.charge({
      amount: grandTotal,
      currency: cart.currency,
      provider: dto.provider as PaymentProviderKey,
      reference: orderNumber,
      description: `Moraqat order ${orderNumber}`,
      customer: {
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
        phone: user.phone ?? undefined,
      },
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/orders`,
    });

    if (!charge.success) {
      throw new HttpException(
        charge.failureReason ?? "Payment failed",
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    const isPending = charge.status === "PENDING" || charge.status === "AUTHORIZED";

    // VAT component of a VAT-inclusive total.
    const netSubtotal = round(grandTotal / (1 + VAT_RATE));
    const taxTotal = round(grandTotal - netSubtotal);

    // 2) Persist order + items + payment + invoice atomically, then clear cart.
    //    Redirect flows persist as PENDING; the PSP webhook confirms later.
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber,
          userId,
          addressId: dto.addressId,
          source: "ONE_TIME",
          status: isPending ? "PENDING" : "CONFIRMED",
          subtotal,
          discountTotal,
          shippingTotal,
          taxTotal,
          grandTotal,
          currency: cart.currency,
          couponCode: cart.coupon?.code,
          items: {
            create: cart.items.map((i) => ({
              productId: i.productId,
              nameEn: i.nameEn,
              nameAr: i.nameAr,
              quantity: i.quantity,
              unitPrice: new Prisma.Decimal(i.unitPrice),
              lineTotal: new Prisma.Decimal(i.lineTotal),
            })),
          },
          payments: {
            create: {
              provider: dto.provider as PaymentProviderKey,
              status: isPending ? "PENDING" : "CAPTURED",
              amount: new Prisma.Decimal(grandTotal),
              currency: cart.currency,
              providerRef: charge.providerRef,
              capturedAt: isPending ? null : new Date(),
            },
          },
          invoice: {
            create: {
              invoiceNumber: makeNumber("INV"),
              userId,
              status: isPending ? "ISSUED" : "PAID",
              subtotal: new Prisma.Decimal(netSubtotal),
              taxTotal: new Prisma.Decimal(taxTotal),
              grandTotal: new Prisma.Decimal(grandTotal),
              paidAt: isPending ? null : new Date(),
            },
          },
        },
        include: { items: true, payments: true, invoice: true },
      });

      if (cart.coupon) {
        await tx.coupon.updateMany({
          where: { code: cart.coupon.code },
          data: { redeemedCount: { increment: 1 } },
        });
      }

      // Empty the cart.
      await tx.cartItem.deleteMany({ where: { cartId: dto.cartId } });
      await tx.cart.update({ where: { id: dto.cartId }, data: { couponId: null } });

      return created;
    });

    await this.notifications.notify(userId, {
      category: "ORDER",
      title: isPending ? "Order awaiting payment" : "Order confirmed",
      body: isPending
        ? `${order.orderNumber} — complete payment to confirm your order.`
        : `${order.orderNumber} — ${Number(order.grandTotal)} ${order.currency}. We're preparing your box!`,
      data: { orderNumber: order.orderNumber },
    });

    // Confirmed orders get a branded confirmation + receipt by email. Pending
    // (redirect/BNPL) orders wait for the capture webhook to confirm first.
    if (!isPending) {
      const buyer = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, firstName: true, locale: true },
      });
      if (buyer?.email) {
        const loc = buyer.locale === "en" ? "en" : "ar";
        const items = order.items.map((it) => ({ name: loc === "ar" ? it.nameAr : it.nameEn, qty: it.quantity }));
        const total = Number(order.grandTotal);
        const conf = orderConfirmationTemplate(loc, buyer.firstName, order.orderNumber, total, items);
        const rcpt = paymentReceiptTemplate(loc, buyer.firstName, order.orderNumber, total, Number(order.taxTotal), order.payments[0]?.provider ?? "—");
        void this.mail.send({ to: buyer.email, subject: conf.subject, html: conf.html, text: conf.text });
        void this.mail.send({ to: buyer.email, subject: rcpt.subject, html: rcpt.html, text: rcpt.text });
      }
    }

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      grandTotal: Number(order.grandTotal),
      taxTotal: Number(order.taxTotal),
      currency: order.currency,
      itemCount: order.items.length,
      // Redirect flows: the client sends the shopper here to complete payment.
      redirectUrl: charge.redirectUrl ?? null,
      payment: {
        provider: order.payments[0]?.provider,
        status: order.payments[0]?.status,
        providerRef: order.payments[0]?.providerRef,
      },
      invoice: order.invoice
        ? { invoiceNumber: order.invoice.invoiceNumber, status: order.invoice.status }
        : null,
    };
  }
}

function makeNumber(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const round = (n: number) => Math.round(n * 100) / 100;
