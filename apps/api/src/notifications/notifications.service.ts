import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildNotificationText,
  type NotificationParams,
  type NotificationType,
} from "./notifications.messages";

type Category =
  | "ORDER"
  | "BILLING"
  | "PROMOTION"
  | "SUBSCRIPTION"
  | "DELIVERY"
  | "COMMUNITY"
  | "SYSTEM";

interface NotifyInput {
  category: Category;
  /** Stable message key — text is localized from the catalogue at write time. */
  type: NotificationType;
  /** Interpolation values for the catalogue (cat name, order number, …). */
  params?: NotificationParams;
  /** Structured payload for deep-linking (catId, slug, ticketNumber, …). */
  data?: Record<string, unknown>;
}

const PAGE_SIZE = 20;

/**
 * In-app notification engine. Every domain event that touches a member writes an
 * IN_APP record here — the portal feed is the source of truth, and the bell's
 * unread badge reads off the same rows. Other channels (email/SMS) are layered
 * on top elsewhere (MailService); this stays the durable, member-readable log.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("Notifications");

  constructor(private readonly prisma: PrismaService) {}

  /** Write an in-app notification. Safe to `void` — never throws to the caller. */
  async notify(userId: string, input: NotifyInput) {
    // Localize once, at write time, for both languages. `title`/`body` keep the
    // English copy as a fallback for any consumer that ignores `data.i18n`; the
    // web renders `data.i18n[locale]` so the feed follows the member's language.
    const i18n = buildNotificationText(input.type, input.params);
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel: "IN_APP",
        category: input.category,
        title: i18n.en.title,
        body: i18n.en.body,
        data: { type: input.type, params: input.params ?? {}, i18n, ...(input.data ?? {}) } as never,
      },
    });
    this.logger.log(`→ ${userId.slice(0, 8)}… [${input.category}] ${input.type}`);
    return notification;
  }

  /** Fire-and-forget wrapper: emit without ever blocking or failing the caller. */
  emit(userId: string, input: NotifyInput): void {
    void this.notify(userId, input).catch((e) =>
      this.logger.warn(`notify failed for ${userId.slice(0, 8)}…: ${String(e)}`)
    );
  }

  async list(userId: string, page = 1) {
    const take = PAGE_SIZE;
    const skip = (Math.max(1, page) - 1) * take;
    const [items, total, unread] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      this.prisma.notification.count({ where: { userId } }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);
    return {
      items,
      unread,
      pagination: {
        page: Math.max(1, page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasMore: skip + items.length < total,
      },
    };
  }

  async unreadCount(userId: string) {
    const unread = await this.prisma.notification.count({ where: { userId, readAt: null } });
    return { unread };
  }

  async markRead(userId: string, id: string) {
    // Scope by userId so a member can never mark another member's row read.
    const res = await this.prisma.notification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    if (res.count === 0) {
      const exists = await this.prisma.notification.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException("Notification not found");
    }
    return { success: true };
  }

  async markAllRead(userId: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { success: true, updated: res.count };
  }
}
