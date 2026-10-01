import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@moraqat/db";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { commerceEnabled } from "../common/config/features";
import { withJobLock } from "../common/jobs/job-lock";

/** Create a box order this many days before its delivery date, so it can be packed. */
const PACK_LEAD_DAYS = 3;
const BATCH = 200;
const INTERVAL_DAYS: Record<string, number> = { WEEKLY: 7, BIWEEKLY: 14, MONTHLY: 30 };

/**
 * Monthly boxes 2…N of a prepaid term.
 *
 * A member pays the whole term upfront; the term's payment order is box 1 and
 * nothing used to create the rest — month two simply never shipped. This job
 * closes that: for every subscription with prepaid boxes still owed and a
 * delivery date inside the packing window, it creates one zero-value cycle
 * order (the money was taken with the term) carrying the household's box.
 *
 * Counting is by BOXES, not dates (boxesPrepaid vs boxesDelivered), so a skip
 * or a pause moves a box later but can never swallow one already paid for —
 * a box still owed after the term ends is still shipped. Each box has a unique
 * cycle key, and the counter only advances through a compare-and-set, so a
 * re-run, a second container or a crash mid-pass cannot ship a box twice.
 *
 * Commercial: does nothing while COMMERCE_ENABLED is off (the cron runs
 * in-process, outside CommerceGuard's reach).
 */
@Injectable()
export class FulfilmentService {
  private readonly logger = new Logger("Fulfilment");

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: "fulfilment" })
  async run() {
    if (!commerceEnabled()) return;
    await withJobLock(this.prisma, "fulfilment", 50 * 60_000, () => this.pass());
  }

  /** One pass; returns how many box orders it created. Public for the tick endpoint and tests. */
  async pass(now: Date = new Date()): Promise<number> {
    if (!commerceEnabled()) return 0;
    const horizon = new Date(now.getTime() + PACK_LEAD_DAYS * 86_400_000);
    const due = await this.prisma.subscription.findMany({
      where: {
        // PAUSED waits; DRAFT never paid; CANCELLED is only reached with nothing
        // left (or after a refund). EXPIRED/PAST_DUE may still be owed boxes.
        status: { in: ["ACTIVE", "PAST_DUE", "EXPIRED"] },
        boxesPrepaid: { gt: 0 },
        nextDeliveryAt: { lte: horizon },
      },
      select: {
        id: true,
        userId: true,
        addressId: true,
        interval: true,
        intervalDays: true,
        nextDeliveryAt: true,
        boxesPrepaid: true,
        boxesDelivered: true,
        plan: { select: { currency: true, nameAr: true, nameEn: true } },
        items: {
          select: { productId: true, quantity: true, product: { select: { nameEn: true, nameAr: true } } },
        },
        cats: { select: { cat: { select: { name: true } } }, take: 1 },
      },
      orderBy: { nextDeliveryAt: "asc" },
      take: BATCH,
    });

    let created = 0;
    for (const sub of due) {
      if (sub.boxesDelivered >= sub.boxesPrepaid || !sub.nextDeliveryAt) continue;
      const n = sub.boxesDelivered + 1;
      const step = sub.intervalDays ?? INTERVAL_DAYS[sub.interval] ?? 30;
      const nextDelivery = new Date(sub.nextDeliveryAt.getTime() + step * 86_400_000);
      try {
        const ok = await this.prisma.$transaction(async (tx) => {
          // Compare-and-set: only the pass that sees the counter at n − 1 wins.
          const claimed = await tx.subscription.updateMany({
            where: { id: sub.id, boxesDelivered: sub.boxesDelivered },
            data: { boxesDelivered: { increment: 1 }, nextDeliveryAt: nextDelivery },
          });
          if (claimed.count === 0) return false;
          await tx.order.create({
            data: {
              orderNumber: boxOrderNumber(),
              userId: sub.userId,
              subscriptionId: sub.id,
              addressId: sub.addressId,
              source: "SUBSCRIPTION",
              status: "CONFIRMED",
              cycleKey: `${sub.id}:${n}`,
              cycleIndex: n,
              // Prepaid with the term — this order carries goods, not money.
              subtotal: new Prisma.Decimal(0),
              taxTotal: new Prisma.Decimal(0),
              grandTotal: new Prisma.Decimal(0),
              currency: sub.plan?.currency ?? "SAR",
              items: sub.items.length
                ? {
                    create: sub.items.map((it) => ({
                      productId: it.productId,
                      nameEn: it.product.nameEn,
                      nameAr: it.product.nameAr,
                      quantity: it.quantity,
                      unitPrice: new Prisma.Decimal(0),
                      lineTotal: new Prisma.Decimal(0),
                    })),
                  }
                : undefined,
            },
          });
          await tx.subscriptionEvent.create({
            data: {
              subscriptionId: sub.id,
              type: "box_scheduled",
              metadata: { box: n, of: sub.boxesPrepaid, deliverBy: sub.nextDeliveryAt!.toISOString() },
            },
          });
          return true;
        });
        if (!ok) continue;
        created++;
        this.notifications.emit(sub.userId, {
          category: "DELIVERY",
          type: "box_scheduled",
          params: {
            name: sub.cats[0]?.cat.name ?? "",
            box: n,
            of: sub.boxesPrepaid,
          },
          data: { subscriptionId: sub.id, link: "/portal/orders" },
        });
      } catch (err) {
        // A unique-key clash means another pass already made this box: fine.
        if ((err as { code?: string })?.code === "P2002") continue;
        this.logger.error(`box ${n} for subscription ${sub.id} failed: ${(err as Error).message}`);
      }
    }
    if (created) this.logger.log(`fulfilment: ${created} box order(s) created`);
    return created;
  }
}

function boxOrderNumber(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `BOX-${date}-${randomBytes(6).toString("hex").toUpperCase()}`;
}
