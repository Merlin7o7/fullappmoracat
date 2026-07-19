import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import {
  orderConfirmationTemplate,
  paymentFailedTemplate,
  paymentReceiptTemplate,
  subscriptionConfirmedTemplate,
} from "../mail/mail.templates";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
  type WebhookEvent,
} from "./payment-provider.interface";
import { firstDeliveryOn } from "../common/config/launch";

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
    // Explicit mapping. Anything unrecognised is a no-op, never a failure.
    const status: WebhookEvent["status"] =
      type === "payment_paid"
        ? "CAPTURED"
        : type === "payment_refunded"
          ? "REFUNDED"
          : type === "payment_failed" || type === "payment_voided"
            ? "FAILED"
            : "IGNORED";
    const providerRef = String(data.id ?? "");
    if (!providerRef) throw new BadRequestException("Missing payment id");
    return {
      providerRef,
      status,
      provider: "moyasar",
      eventType: type,
      eventId: String(body.id ?? data.id ?? providerRef),
      raw: body,
    };
  }

  parseTabby(headers: Record<string, string | undefined>, body: Record<string, unknown>): WebhookEvent {
    const expected = process.env.TABBY_WEBHOOK_SECRET;
    if (!expected) throw new UnauthorizedException("Tabby webhook secret not configured");
    const got = headers["x-webhook-secret"] ?? "";
    if (!safeEqual(got, expected)) throw new UnauthorizedException("Bad webhook secret");

    const providerRef = String(body.id ?? "");
    const st = String(body.status ?? "").toLowerCase();
    const status: WebhookEvent["status"] =
      st === "authorized" || st === "closed"
        ? "CAPTURED"
        : st === "rejected" || st === "expired"
          ? "FAILED"
          : st === "refunded"
            ? "REFUNDED"
            : "IGNORED"; // e.g. "created", "new" — informational only
    if (!providerRef) throw new BadRequestException("Missing payment id");
    return {
      providerRef,
      status,
      provider: "tabby",
      eventType: st,
      eventId: `${providerRef}:${st}`,
      raw: body,
    };
  }

  parseTamara(token: string, body: Record<string, unknown>): WebhookEvent {
    const secret = process.env.TAMARA_NOTIFICATION_TOKEN;
    if (!secret) throw new UnauthorizedException("Tamara notification token not configured");
    // `token` is the JWT Tamara sends as ?tamaraToken=… / Authorization: Bearer.
    if (!token) throw new UnauthorizedException("Invalid tamaraToken");
    const claims = verifyHs256Jwt(token, secret);
    if (!claims) throw new UnauthorizedException("Invalid tamaraToken");

    const providerRef = String(body.order_id ?? "");
    if (!providerRef) throw new BadRequestException("Missing order id");

    // Bind the token to THIS payload. Without it, one valid token settles any
    // order the attacker names.
    const claimedOrder = String(claims.order_id ?? claims.orderId ?? claims.sub ?? "");
    if (claimedOrder && claimedOrder !== providerRef) {
      throw new UnauthorizedException("tamaraToken does not match this order");
    }

    const eventType = String(body.event_type ?? "").toLowerCase();
    const status: WebhookEvent["status"] =
      eventType === "order_approved" || eventType === "order_authorised"
        ? "CAPTURED"
        : eventType === "order_refunded"
          ? "REFUNDED"
          : eventType === "order_declined" || eventType === "order_expired" || eventType === "order_canceled"
            ? "FAILED"
            : "IGNORED";
    return {
      providerRef,
      status,
      provider: "tamara",
      eventType,
      // Tamara re-sends both order_approved and order_authorised for one order;
      // scoping the replay key by event type keeps each actionable once.
      eventId: `${providerRef}:${eventType}`,
      raw: body,
    };
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
    // Explicit, like the real adapters: an unrecognised status is a no-op, not
    // an implicit capture. Omitting `status` still means CAPTURED so existing
    // callers that just settle an order keep working.
    const raw = body.status === undefined ? "CAPTURED" : String(body.status);
    const status: WebhookEvent["status"] =
      raw === "CAPTURED" ? "CAPTURED" : raw === "FAILED" ? "FAILED" : raw === "REFUNDED" ? "REFUNDED" : "IGNORED";
    if (!providerRef) throw new BadRequestException("Missing providerRef");
    return {
      providerRef,
      status,
      provider: "mock",
      eventType: String(body.status ?? "CAPTURED"),
      // Mock deliveries are re-fired by tests on purpose; keep them replayable
      // by including a nonce when one is supplied.
      eventId: body.eventId ? String(body.eventId) : undefined,
      raw: body,
    };
  }

  // ── Settlement (idempotent) ───────────────────────────────────────────────

  async settle(event: WebhookEvent) {
    // A non-actionable lifecycle event (authorised, created, updated…). Ack it
    // so the PSP stops retrying, and change nothing.
    if (event.status === "IGNORED") {
      this.logger.log(
        `ignoring non-actionable ${event.provider ?? "?"} event ${event.eventType ?? "?"} for ${event.providerRef}`
      );
      return { orderNumber: null, status: "ignored" as const };
    }

    // Replay suppression. Signature verification proves authenticity, not
    // freshness: a captured delivery can be replayed verbatim. Claiming the
    // event id first makes a repeat a no-op rather than a second settlement.
    if (event.eventId && event.provider) {
      try {
        await this.prisma.processedWebhookEvent.create({
          data: {
            provider: event.provider,
            eventId: event.eventId,
            eventType: event.eventType ?? null,
            payloadRef: event.providerRef,
          },
        });
      } catch {
        this.logger.warn(`replayed ${event.provider} event ${event.eventId} — ignoring`);
        return { orderNumber: null, status: "replayed" as const };
      }
    }

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

      // Atomically claim this settlement before touching money. Tamara emits
      // BOTH `order_approved` AND `order_authorised` for a single order (plus
      // retries), and Nest handles them concurrently — so without a claim, two
      // deliveries can each pass the read above, both call capture(), and the
      // member is charged twice and emailed twice. A double charge is the #1
      // trust-killer in KSA (R025), so prevent it, never apologise for it (R115).
      //
      // Only a PENDING payment is claimable; the winner flips it to AUTHORIZED
      // (an "in-progress" marker — never persisted at charge time, so it's
      // unambiguous) and proceeds. Concurrent losers match nothing and no-op.
      const claim = await this.prisma.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "AUTHORIZED" },
      });
      if (claim.count === 0) {
        return { orderNumber: payment.order.orderNumber, status: "already_settling" };
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
          // Reach the member even if they closed the redirect tab — a silent
          // dead-end is not a recovery (R112). Notification + retry email.
          await this.notifyPaymentFailed(payment.order);
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
      // Tell the member, on-app and by email, with a one-tap way back (R112/R118).
      await this.notifyPaymentFailed(payment.order);
      return { orderNumber: payment.order.orderNumber, status: "failed" };
    }

    // ── REFUNDED ────────────────────────────────────────────────────────────
    // Previously an unguarded status write. Two failures came out of that:
    //
    //   * A PSP-initiated refund left the order CONFIRMED, the invoice PAID and
    //     the subscription ACTIVE, and wrote no Refund row — so the
    //     `refundedSoFar` aggregate read 0 and the books said "paid" while the
    //     money was gone.
    //   * An out-of-order void arriving while the payment was still PENDING
    //     flipped it to REFUNDED, and the genuine capture that followed then
    //     failed the CAS claim, wedging the order in PENDING forever.
    //
    // Refunding is only meaningful for money actually collected.
    if (payment.status !== "CAPTURED") {
      this.logger.warn(
        `refund event for ${payment.order.orderNumber} while payment is ${payment.status} — ignoring`
      );
      return { orderNumber: payment.order.orderNumber, status: "ignored" };
    }

    const amount = Number(payment.amount);
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
      // Mirrors the terminal states the admin refund path already writes
      // (refunds.service.ts) so both routes leave the books in one shape.
      await tx.refund.create({
        data: {
          paymentId: payment.id,
          amount: new Prisma.Decimal(amount),
          reason: "Refunded by payment provider",
          providerRef: event.providerRef,
        },
      });
      await tx.order.update({ where: { id: payment.orderId }, data: { status: "RETURNED" } });
      await tx.invoice.updateMany({
        where: { orderId: payment.orderId },
        data: { status: "REFUNDED" },
      });
      // A refunded first charge means the membership never really began.
      if (payment.order.subscriptionId) {
        await tx.subscription.updateMany({
          where: { id: payment.order.subscriptionId, status: { in: ["DRAFT", "ACTIVE"] } },
          data: { status: "CANCELLED", cancelledAt: new Date() },
        });
      }
    });

    await this.notifications
      .notify(payment.order.userId, {
        category: "ORDER",
        type: "order_refunded",
        params: { orderNumber: payment.order.orderNumber, total: amount, currency: payment.currency },
        data: { orderNumber: payment.order.orderNumber },
      })
      .catch((e) => this.logger.error(`refund notification failed: ${e}`));

    this.logger.log(`refunded ${payment.order.orderNumber} via webhook (${amount})`);
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
    // deliveries stay monthly. An invited RENEWAL stored its future base in
    // startedAt at draft time — stack from it so the member loses no paid days.
    const base = sub.startedAt && sub.startedAt.getTime() > now.getTime() ? sub.startedAt : now;
    const termEnd = addMonthsClamped(base, sub.termMonths ?? 3);
    // Pre-launch: every founding member's first box ships on the launch date
    // (central launch config). After launch it's the normal monthly cadence.
    const firstDelivery = firstDeliveryOn(addMonthsClamped(base, 1));
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "ACTIVE",
          startedAt: base,
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

  /**
   * A failed first charge must never be a silent dead-end (R112). Reach the
   * member wherever they are — an in-app notification for when they return, and
   * a warm retry email for when they closed the redirect tab. Nothing was
   * charged; the way forward is one tap (R118/R120).
   */
  private async notifyPaymentFailed(order: { orderNumber: string; userId: string }) {
    await this.notifications.notify(order.userId, {
      category: "ORDER",
      type: "payment_failed",
      params: { orderNumber: order.orderNumber },
      data: { orderNumber: order.orderNumber },
    });

    const buyer = await this.prisma.user.findUnique({
      where: { id: order.userId },
      select: { email: true, firstName: true, locale: true },
    });
    if (!buyer?.email) return;
    const loc = buyer.locale === "en" ? "en" : "ar";
    const retryUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/subscribe`;
    const tpl = paymentFailedTemplate(loc, buyer.firstName, retryUrl);
    void this.mail.send({ to: buyer.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
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

/**
 * HS256 JWT verification that also validates the claims.
 *
 * Signature-only verification was replayable: a single legitimately-obtained
 * token (an attacker's own order is enough) stayed valid forever and could be
 * presented alongside an attacker-chosen body to force-settle ANY pending order,
 * because nothing tied the token to the payload it arrived with.
 *
 * Returns the decoded claims on success so the caller can bind them to the body.
 */
function verifyHs256Jwt(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];
  const expected = createHmac("sha256", secret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  if (!safeEqual(signature, expected)) return null;

  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const skew = 300; // tolerate modest clock drift between us and the PSP
  if (typeof claims.exp === "number" && claims.exp + skew < now) return null;
  if (typeof claims.nbf === "number" && claims.nbf - skew > now) return null;
  if (typeof claims.iat === "number" && claims.iat - skew > now) return null;

  return claims;
}
