import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

type Category = "ORDER" | "BILLING" | "PROMOTION" | "SUBSCRIPTION" | "DELIVERY" | "SYSTEM";

interface NotifyInput {
  category: Category;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * In-app notification engine. Other channels (email/SMS/WhatsApp) plug in here
 * later behind NOTIFICATIONS_MODE — the in-app record is always written so the
 * portal feed is the source of truth.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger("Notifications");

  constructor(private readonly prisma: PrismaService) {}

  async notify(userId: string, input: NotifyInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        channel: "IN_APP",
        category: input.category,
        title: input.title,
        body: input.body,
        data: (input.data ?? undefined) as never,
      },
    });
    this.logger.log(`→ ${userId.slice(0, 8)}… [${input.category}] ${input.title}`);
    return notification;
  }
}
