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
import { splitVat } from "../common/config/pricing";
import { IdempotencyService } from "../common/idempotency.service";
import { claimCoupon } from "../common/coupons";

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cart: CartService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly idempotency: IdempotencyService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  /**
   * Buy a cart.
   *
   * Ordering matters and is deliberate:
   *
   *   1. Claim the cart (ACTIVE → CHECKING_OUT) with a status-guarded update.
   *      A double-tap loses the race here, before any money moves.
   *   2. Persist order + payment as an INTENT (PENDING) *before* calling the
   *      PSP. Previously the charge happened first, so a crash between the
   *      charge returning and the transaction committing left money captured
   *      with no order, no payment row and nothing to reconcile against.
   *   3. Charge, then settle the intent with the provider's answer.
   *
   * An `Idempotency-Key` wraps the whole thing so a network retry replays the
   * original result rather than charging again.
   */
  async checkout(userId: string, dto: CheckoutDto, idempotencyKey?: string) {
    return this.idempotency.run(
      { scope: "checkout", key: idempotencyKey, userId, request: dto },
      () => this.performCheckout(userId, dto)
    );
  }

  private async performCheckout(userId: string, dto: CheckoutDto) {
    // Defense-in-depth behind the route-level @Commercial guard: even an
    // internal caller can never move money while Community Mode is active.
    if (!commerceEnabled()) {
      throw new HttpException(
        { code: "MEMBERSHIPS_COMING_SOON", message: "Checkout is not available yet." },
        HttpStatus.FORBIDDEN
      );
    }

    // Ownership-checked: the buyer must own this cart, or present the guest
    // token for a basket they built before signing in (which claims it). A cart
    // id alone is not a credential — previously any id could be checked out,
    // charging the wrong person and destroying the real owner's basket.
    const cart = await this.cart.get(dto.cartId, { userId, token: dto.cartToken ?? null });
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

    // 1) Claim the cart. A status-guarded update is the concurrency primitive:
    //    a double-tapped checkout loses this race and is rejected before any
    //    money moves, rather than producing a second order and a second charge.
    const claimed = await this.prisma.cart.updateMany({
      where: { id: dto.cartId, status: "ACTIVE" },
      data: { status: "CHECKING_OUT" },
    });
    if (claimed.count === 0) {
      throw new HttpException(
        { code: "CHECKOUT_IN_PROGRESS", message: "This cart is already being checked out." },
        HttpStatus.CONFLICT
      );
    }

    // VAT component (0 while not VAT-registered; splitVat honours the toggle).
    // NOTE the two views of the same money, both correct and both preserved:
    //   order.subtotal    — GROSS line-item total, what the customer sees, and
    //                       subtotal - discount + shipping === grandTotal.
    //   invoice.subtotal  — NET of VAT, the taxable base, and net + tax === grandTotal.
    const { net: netSubtotal, tax: taxTotal } = splitVat(grandTotal);

    try {
      // 2) Persist the INTENT before charging. If the process dies mid-charge
      //    there is now an order + PENDING payment to reconcile against; the
      //    old charge-then-persist order left orphaned money at the PSP with no
      //    local trace at all.
      const intent = await this.prisma.$transaction(async (tx) => {
        const orderNumber = await this.nextNumber(tx, "MRQ", "order");
        const created = await tx.order.create({
          data: {
            orderNumber,
            userId,
            addressId: dto.addressId,
            source: "ONE_TIME",
            status: "PENDING",
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
                status: "PENDING",
                amount: new Prisma.Decimal(grandTotal),
                currency: cart.currency,
              },
            },
            invoice: {
              create: {
                invoiceNumber: await this.nextNumber(tx, "INV", "invoice"),
                userId,
                status: "ISSUED",
                subtotal: new Prisma.Decimal(netSubtotal),
                taxTotal: new Prisma.Decimal(taxTotal),
                grandTotal: new Prisma.Decimal(grandTotal),
              },
            },
          },
          include: { items: true, payments: true, invoice: true },
        });

        // Coupon caps enforced atomically inside the same transaction, with a
        // per-user ledger row. Throws (rolling back the intent) if the cap is
        // exhausted or this user has already used the code.
        if (cart.coupon) {
          await claimCoupon(tx, { code: cart.coupon.code, userId, orderId: created.id });
        }

        return created;
      });

      // 3) Charge (or open a hosted-checkout session).
      const adapter = this.payments.resolve(dto.provider as PaymentProviderKey);
      const charge = await adapter.charge({
        amount: grandTotal,
        currency: cart.currency,
        provider: dto.provider as PaymentProviderKey,
        reference: intent.orderNumber,
        description: `Moraqat order ${intent.orderNumber}`,
        customer: {
          email: user.email,
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
          phone: user.phone ?? undefined,
        },
        returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/orders`,
      });

      if (!charge.success) {
        // Mark the intent failed and release the cart so the shopper can retry
        // with a different method. The basket is deliberately NOT emptied.
        await this.prisma.$transaction([
          this.prisma.payment.updateMany({
            where: { orderId: intent.id },
            data: { status: "FAILED", failureReason: charge.failureReason ?? "Payment failed" },
          }),
          this.prisma.order.update({ where: { id: intent.id }, data: { status: "FAILED" } }),
          this.prisma.invoice.updateMany({ where: { orderId: intent.id }, data: { status: "VOID" } }),
          this.prisma.cart.update({ where: { id: dto.cartId }, data: { status: "ACTIVE" } }),
        ]);
        throw new HttpException(
          charge.failureReason ?? "Payment failed",
          HttpStatus.PAYMENT_REQUIRED
        );
      }

      const isPending = charge.status === "PENDING" || charge.status === "AUTHORIZED";

      // 4) Settle the intent with the provider's answer, and consume the cart.
      const order = await this.prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { orderId: intent.id },
          data: {
            status: isPending ? "PENDING" : "CAPTURED",
            providerRef: charge.providerRef,
            capturedAt: isPending ? null : new Date(),
            ...(charge.redirectUrl ? { metadata: { redirectUrl: charge.redirectUrl } } : {}),
          },
        });
        await tx.order.update({
          where: { id: intent.id },
          data: { status: isPending ? "PENDING" : "CONFIRMED" },
        });
        if (!isPending) {
          await tx.invoice.updateMany({
            where: { orderId: intent.id },
            data: { status: "PAID", paidAt: new Date() },
          });
        }

        // Consume the cart. CONVERTED (not deleted) preserves the audit trail
        // and makes the terminal state explicit.
        await tx.cartItem.deleteMany({ where: { cartId: dto.cartId } });
        await tx.cart.update({
          where: { id: dto.cartId },
          data: { couponId: null, status: "CONVERTED" },
        });

        return tx.order.findUniqueOrThrow({
          where: { id: intent.id },
          include: { items: true, payments: true, invoice: true },
        });
      });

    await this.notifications.notify(userId, {
      category: "ORDER",
      type: isPending ? "order_pending" : "order_confirmed",
      params: {
        orderNumber: order.orderNumber,
        total: Number(order.grandTotal),
        currency: order.currency,
      },
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
    } catch (err) {
      // Any failure after the claim must release the cart, or the shopper is
      // permanently locked out of their own basket. Deliberately does not
      // clobber a cart already moved to CONVERTED by a successful settlement.
      await this.prisma.cart
        .updateMany({
          where: { id: dto.cartId, status: "CHECKING_OUT" },
          data: { status: "ACTIVE" },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  /**
   * Collision-resistant human-readable document number.
   *
   * `randomBytes(3)` gave 16.7M values per day-prefix, where the birthday bound
   * makes a collision likely at only a few thousand orders/day — and the throw
   * landed INSIDE the transaction, after the charge had already succeeded. Six
   * bytes plus a bounded retry against the live uniqueness check removes both
   * the collision and the "money taken, order lost" failure it caused.
   */
  private async nextNumber(
    tx: Prisma.TransactionClient,
    prefix: string,
    kind: "order" | "invoice"
  ): Promise<string> {
    const d = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = `${prefix}-${date}-${randomBytes(6).toString("hex").toUpperCase()}`;
      const taken =
        kind === "order"
          ? await tx.order.findUnique({ where: { orderNumber: candidate }, select: { id: true } })
          : await tx.invoice.findUnique({
              where: { invoiceNumber: candidate },
              select: { id: true },
            });
      if (!taken) return candidate;
    }
    // 5 consecutive collisions in a 2^48 space means something is badly wrong.
    throw new HttpException("Could not allocate a document number", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
