import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import {
  orderConfirmationTemplate,
  paymentReceiptTemplate,
  subscriptionConfirmedTemplate,
} from "../mail/mail.templates";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
  type WebhookEvent,
} from "./payment-provider.interface";

/**
 * Verifies and settles PSP webhooks. Each provider authenticates differently:
 *
 *  - moyasar : payload carries the `secret_token` you registered the hook with.
 *  - tabby   : echoes back the custom header you registered (X-Webhook-Secret).
 *  - tamara  : sends `tamaratoken`, an HS256 JWT signed with your notification key.
 *
 * All comparisons are constant-time. Settlement is idempotent — replaying a
 * webhook never double-applies.
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger("Webhooks");

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  // ── Verification + parsing per provider ──────────────────────────────────

  parseMoyasar(body: Record<string, unknown>): WebhookEvent {
    const expected = process.env.MOYASAR_WEBHOOK_SECRET;
    if (!expected) throw new UnauthorizedException("Moyasar webhook secret not configured");
    const got = String(body.secret_token ?? "");
    if (!safeEqual(got, expected)) throw new UnauthorizedException("Bad webhook secret");

    const data = (body.data ?? body) as Record<string, unknown>;
    const type = String(body.type ?? "");
    const status: WebhookEvent["status"] =
      type === "payment_paid" ? "CAPTURED" : type === "payment_refunded" ? "REFUNDED" : "FAILED";
    const providerRef = String(data.id ?? "");
    if (!providerRef) throw new BadRequestException("Missing payment id");
    return { providerRef, status, raw: body };
  }

  parseTabby(headers: Record<string, string | undefined>, body: Record<string, unknown>): WebhookEvent {
    const expected = process.env.TABBY_WEBHOOK_SECRET;
    if (!expected) throw new UnauthorizedException("Tabby webhook secret not configured");
    const got = headers["x-webhook-secret"] ?? "";
    if (!safeEqual(got, expected)) throw new UnauthorizedException("Bad webhook secret");

    const providerRef = String(body.id ?? "");
    const st = String(body.status ?? "").toLowerCase();
    const status: WebhookEvent["status"] =
      st === "authorized" || st === "closed" ? "CAPTURED" : st === "rejected" || st === "expired" ? "FAILED" : "FAILED";
    if (!providerRef) throw new BadRequestException("Missing payment id");
    return { providerRef, status, raw: body };
  }

  parseTamara(token: string, body: Record<string, unknown>): WebhookEvent {
    const secret = process.env.TAMARA_NOTIFICATION_TOKEN;
    if (!secret) throw new UnauthorizedException("Tamara notification token not configured");
    // `token` is the JWT Tamara sends as ?tamaraToken=… / Authorization: Bearer.
    if (!token || !verifyHs256Jwt(token, secret)) throw new UnauthorizedException("Invalid tamaraToken");

    const providerRef = String(body.order_id ?? "");
    const eventType = String(body.event_type ?? "").toLowerCase();
    const status: WebhookEvent["status"] =
      eventType === "order_approved" || eventType === "order_authorised"
        ? "CAPTURED"
        : eventType === "order_refunded"
          ? "REFUNDED"
          : "FAILED";
    if (!providerRef) throw new BadRequestException("Missing order id");
    return { providerRef, status, raw: body };
  }

  /** Dev-only settlement hook for the mock provider (PAYMENTS_MODE=mock). */
  parseMock(headers: Record<string, string | undefined>, body: Record<string, unknown>): WebhookEvent {
    if ((process.env.PAYMENTS_MODE ?? "mock") === "live") {
      throw new UnauthorizedException("Mock webhooks are disabled in live mode");
    }
    const expected = process.env.MOCK_WEBHOOK_SECRET ?? "mock-webhook-secret";
    if (!safeEqual(headers["x-webhook-secret"] ?? "", expected)) {
      throw new UnauthorizedException("Bad webhook secret");
    }
    const providerRef = String(body.providerRef ?? "");
    const status = body.status === "FAILED" ? "FAILED" : ("CAPTURED" as const);
    if (!providerRef) throw new BadRequestException("Missing providerRef");
    return { providerRef, status, raw: body };
  }

  // ── Settlement (idempotent) ───────────────────────────────────────────────

  async settle(event: WebhookEvent) {
    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: event.providerRef },
      include: {
        order: {
          select: { id: true, orderNumber: true, status: true, userId: true, subscriptionId: true },
        },
      },
    });
    if (!payment) throw new NotFoundException("Payment not found for webhook");

    if (event.status === "CAPTURED") {
      if (payment.status === "CAPTURED") {
        return { orderNumber: payment.order.orderNumber, status: "already_captured" };
      }

      // Some rails (Tamara) only authorise on approval and need an explicit
      // capture to actually collect. Do it BEFORE we mark the order paid and
      // flip the membership live — never activate against money we haven't
      // captured (R006). Providers that capture synchronously omit capture().
      const adapter = this.payments.resolve(payment.provider as PaymentProviderKey);
      if (adapter.capture) {
        const cap = await adapter.capture(
          event.providerRef,
          Number(payment.amount),
          payment.currency,
          payment.order.orderNumber
        );
        if (!cap.success) {
          this.logger.warn(
            `capture failed for ${payment.order.orderNumber}: ${cap.failureReason ?? "unknown"}`
          );
          await this.prisma.$transaction([
            this.prisma.payment.update({
              where: { id: payment.id },
              data: { status: "FAILED", failureReason: cap.failureReason ?? "Capture failed" },
            }),
            this.prisma.order.update({ where: { id: payment.orderId }, data: { status: "FAILED" } }),
            this.prisma.invoice.updateMany({ where: { orderId: payment.orderId }, data: { status: "VOID" } }),
          ]);
          // The DRAFT membership never truly began — close it out honestly (R118).
          await this.cancelDraftSubscription(payment.order.subscriptionId, payment.order.orderNumber);
          return { orderNumber: payment.order.orderNumber, status: "capture_failed" };
        }
      }

      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: "CAPTURED", capturedAt: new Date() },
        }),
        this.prisma.order.update({
          where: { id: payment.orderId },
          data: { status: "CONFIRMED" },
        }),
        this.prisma.invoice.updateMany({
          where: { orderId: payment.orderId },
          data: { status: "PAID", paidAt: new Date() },
        }),
      ]);
      await this.notifications.notify(payment.order.userId, {
        category: "ORDER",
        type: "payment_received",
        params: { orderNumber: payment.order.orderNumber },
        data: { orderNumber: payment.order.orderNumber },
      });

      // A redirect-flow membership persists as DRAFT until the PSP confirms —
      // this capture is the moment it goes live (mirrors activate()'s
      // non-pending path: dates, cat membership, the member's confirmation).
      const activatedPlanName = await this.activateDraftSubscription(
        payment.order.subscriptionId,
        payment.order.orderNumber
      );

      // Receipts land the moment money moves, even on redirect flows (R024).
      await this.sendCaptureEmails(payment.order, activatedPlanName);

      this.logger.log(`captured ${payment.order.orderNumber} via webhook`);
      return { orderNumber: payment.order.orderNumber, status: "captured" };
    }

    if (event.status === "FAILED") {
      if (payment.status !== "PENDING" && payment.status !== "AUTHORIZED") {
        return { orderNumber: payment.order.orderNumber, status: "ignored" };
      }
      await this.prisma.$transaction([
        this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED", failureReason: "Declined via webhook" },
        }),
        this.prisma.order.update({ where: { id: payment.orderId }, data: { status: "FAILED" } }),
        this.prisma.invoice.updateMany({ where: { orderId: payment.orderId }, data: { status: "VOID" } }),
      ]);
      // A DRAFT membership whose first charge failed never began — close it
      // out honestly rather than leaving a phantom subscription (R118).
      await this.cancelDraftSubscription(payment.order.subscriptionId, payment.order.orderNumber);
      return { orderNumber: payment.order.orderNumber, status: "failed" };
    }

    // REFUNDED — reconcile if the PSP initiated it.
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    return { orderNumber: payment.order.orderNumber, status: "refunded" };
  }

  // ── Subscription settlement (redirect flows persist as DRAFT) ────────────

  /** Flips a DRAFT membership live once its first charge captures. */
  private async activateDraftSubscription(
    subscriptionId: string | null,
    orderNumber: string
  ): Promise<{ plan: { nameEn: string; nameAr: string }; next: Date } | null> {
    if (!subscriptionId) return null;
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        plan: { select: { nameEn: true, nameAr: true } },
        cats: { select: { catId: true } },
      },
    });
    if (!sub || sub.status !== "DRAFT" || !sub.plan) return null;

    const now = new Date();
    // The whole committed term was paid upfront, so renewal is due at term end;
    // deliveries stay monthly.
    const termEnd = addMonthsClamped(now, sub.termMonths ?? 3);
    const firstDelivery = addMonthsClamped(now, 1);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          startedAt: now,
          endsAt: termEnd,
          nextBillingAt: termEnd,
          nextDeliveryAt: firstDelivery,
          events: { create: { type: "activated", metadata: { orderNumber, via: "webhook" } } },
        },
      }),
      this.prisma.cat.updateMany({
        where: { id: { in: sub.cats.map((c) => c.catId) } },
        data: { membershipStatus: "ACTIVE" },
      }),
    ]);
    this.logger.log(`subscription ${sub.id} activated via webhook (${orderNumber})`);
    return { plan: sub.plan, next: termEnd };
  }

  /** A DRAFT membership whose first charge failed is closed, never left hanging. */
  private async cancelDraftSubscription(subscriptionId: string | null, orderNumber: string) {
    if (!subscriptionId) return;
    const sub = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { id: true, status: true },
    });
    if (!sub || sub.status !== "DRAFT") return;
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        events: { create: { type: "activation_failed", metadata: { orderNumber } } },
      },
    });
  }

  /** Receipts + confirmation the moment money moves, even on redirect flows (R024). */
  private async sendCaptureEmails(
    order: { id: string; orderNumber: string; userId: string },
    activated: { plan: { nameEn: string; nameAr: string }; next: Date } | null
  ) {
    const buyer = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { email: true, firstName: true, locale: true },
    });
    if (!buyer?.email) return;
    const loc = buyer.locale === "en" ? "en" : "ar";

    const full = await this.prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true, payments: true },
    });
    const total = Number(full.grandTotal);
    const tax = Number(full.taxTotal);

    if (activated) {
      const nextAt = activated.next.toLocaleDateString(loc === "ar" ? "ar-SA" : "en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      const planName = loc === "ar" ? activated.plan.nameAr : activated.plan.nameEn;
      const conf = subscriptionConfirmedTemplate(loc, buyer.firstName, planName, nextAt);
      void this.mail.send({ to: buyer.email, subject: conf.subject, html: conf.html, text: conf.text });
    } else {
      const items = full.items.map((it) => ({
        name: loc === "ar" ? it.nameAr : it.nameEn,
        qty: it.quantity,
      }));
      const conf = orderConfirmationTemplate(loc, buyer.firstName, order.orderNumber, total, items);
      void this.mail.send({ to: buyer.email, subject: conf.subject, html: conf.html, text: conf.text });
    }

    const rcpt = paymentReceiptTemplate(
      loc,
      buyer.firstName,
      order.orderNumber,
      total,
      tax,
      full.payments[0]?.provider ?? "—"
    );
    void this.mail.send({ to: buyer.email, subject: rcpt.subject, html: rcpt.html, text: rcpt.text });
  }
}

/** Month arithmetic that never overflows (Jan 31 + 1mo → Feb 28/29). */
function addMonthsClamped(d: Date, months: number): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setDate(1);
  r.setMonth(r.getMonth() + months);
  const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
  r.setDate(Math.min(day, last));
  return r;
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Minimal HS256 JWT verification (header.payload.signature). */
function verifyHs256Jwt(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return safeEqual(signature, expected);
}
