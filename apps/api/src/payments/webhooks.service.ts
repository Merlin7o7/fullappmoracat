import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import type { WebhookEvent } from "./payment-provider.interface";

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
    private readonly notifications: NotificationsService
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

  parseTamara(headers: Record<string, string | undefined>, body: Record<string, unknown>): WebhookEvent {
    const secret = process.env.TAMARA_NOTIFICATION_TOKEN;
    if (!secret) throw new UnauthorizedException("Tamara notification token not configured");
    const token = headers["tamaratoken"] ?? "";
    if (!verifyHs256Jwt(token, secret)) throw new UnauthorizedException("Invalid tamaraToken");

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
      include: { order: { select: { id: true, orderNumber: true, status: true, userId: true } } },
    });
    if (!payment) throw new NotFoundException("Payment not found for webhook");

    if (event.status === "CAPTURED") {
      if (payment.status === "CAPTURED") {
        return { orderNumber: payment.order.orderNumber, status: "already_captured" };
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
      return { orderNumber: payment.order.orderNumber, status: "failed" };
    }

    // REFUNDED — reconcile if the PSP initiated it.
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: "REFUNDED" } });
    return { orderNumber: payment.order.orderNumber, status: "refunded" };
  }
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
