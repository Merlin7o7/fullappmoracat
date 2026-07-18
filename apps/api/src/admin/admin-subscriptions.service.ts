import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";

const INTERVAL_DAYS: Record<string, number> = {
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
};

/**
 * Staff-side subscription actions for the care team. Deliberately mirrors the
 * member-facing SubscriptionsService semantics (which is module-private):
 *
 * - pause  → deliveries stop but the PAID benefit stays: cats remain ACTIVE
 *            members (R062). Only `pausedAt` is stamped.
 * - resume → gives every paused day back: endsAt / nextBillingAt slide forward
 *            by the paused duration, next delivery re-schedules.
 * - cancel → honest cancel (R063/R064): a prepaid term is NEVER confiscated.
 *            Time left on the clock ⇒ cancelAtTermEnd (won't renew, keeps
 *            servicing until endsAt). Nothing left ⇒ cancel now + lapse.
 *
 * Every action is audit-logged with the acting staff member + reason, and a
 * SubscriptionEvent marks it as staff-initiated so the member timeline is honest.
 */
@Injectable()
export class AdminSubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      include: subInclude,
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    return this.serialize(sub);
  }

  async pause(actorId: string, id: string, reason?: string) {
    const sub = await this.load(id);
    if (sub.status === "PAUSED") {
      throw new BadRequestException("This membership is already paused.");
    }
    if (sub.status !== "ACTIVE") {
      throw new BadRequestException("Only active memberships can be paused.");
    }
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: {
          status: "PAUSED",
          pausedAt: new Date(),
          events: { create: { type: "paused", metadata: { by: "staff", reason: reason ?? null } } },
        },
      }),
      this.audit(actorId, "subscription.pause", id, reason),
    ]);
    // Paid benefit stays while paused (R062): cats deliberately NOT deactivated.
    return this.detail(id);
  }

  async resume(actorId: string, id: string, reason?: string) {
    const sub = await this.load(id);
    if (sub.status !== "PAUSED") {
      throw new BadRequestException("Only paused memberships can be resumed.");
    }
    const now = new Date();
    const pausedMs = sub.pausedAt ? now.getTime() - sub.pausedAt.getTime() : 0;
    const pausedDays = Math.max(0, Math.round(pausedMs / 86_400_000));
    // Give the paused days back — the term end and next delivery both slide.
    const newEndsAt = sub.endsAt ? addDays(sub.endsAt, pausedDays) : null;
    const nextDelivery = addDays(now, INTERVAL_DAYS[sub.interval] ?? sub.intervalDays ?? 30);
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: {
          status: "ACTIVE",
          pausedAt: null,
          pausedUntil: null,
          endsAt: newEndsAt,
          // Renewal stays due at (the now-extended) term end — never "+30 days".
          nextBillingAt: newEndsAt,
          nextDeliveryAt: nextDelivery,
          events: { create: { type: "resumed", metadata: { by: "staff", pausedDays, reason: reason ?? null } } },
        },
      }),
      this.audit(actorId, "subscription.resume", id, reason),
    ]);
    await this.syncCatsMembership(sub.cats.map((c) => c.catId));
    return this.detail(id);
  }

  async cancel(actorId: string, id: string, reason?: string) {
    const sub = await this.load(id);
    if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
      throw new BadRequestException("This membership is already cancelled.");
    }
    const now = new Date();
    const hasRemainingTerm = sub.endsAt != null && sub.endsAt.getTime() > now.getTime();

    if (hasRemainingTerm) {
      // "Won't renew" — the member keeps everything they paid for until endsAt.
      await this.prisma.$transaction([
        this.prisma.subscription.update({
          where: { id },
          data: {
            cancelAtTermEnd: true,
            events: {
              create: {
                type: "cancel_scheduled",
                metadata: { by: "staff", endsAt: sub.endsAt?.toISOString(), reason: reason ?? null },
              },
            },
          },
        }),
        this.audit(actorId, "subscription.cancel_scheduled", id, reason),
      ]);
      return this.detail(id);
    }

    // No paid term remaining → cancel now and lapse the benefit.
    await this.prisma.$transaction([
      this.prisma.subscription.update({
        where: { id },
        data: {
          status: "CANCELLED",
          cancelledAt: now,
          events: { create: { type: "cancelled", metadata: { by: "staff", reason: reason ?? null } } },
        },
      }),
      this.audit(actorId, "subscription.cancel", id, reason),
    ]);
    await this.syncCatsMembership(sub.cats.map((c) => c.catId));
    return this.detail(id);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async load(id: string) {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
      select: {
        id: true, status: true, endsAt: true, pausedAt: true,
        interval: true, intervalDays: true,
        cats: { select: { catId: true } },
      },
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    return sub;
  }

  private audit(actorId: string, action: string, subscriptionId: string, reason?: string) {
    return this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action,
        entityType: "Subscription",
        entityId: subscriptionId,
        metadata: { reason: reason ?? null },
      },
    });
  }

  /**
   * Same recompute as the member flow: a cat's membership is ACTIVE iff it's
   * covered by at least one ACTIVE subscription. The Cat ID itself never
   * changes — only the membership status gates.
   */
  private async syncCatsMembership(catIds: string[]) {
    for (const catId of catIds) {
      const activeCount = await this.prisma.subscriptionCat.count({
        where: { catId, subscription: { status: "ACTIVE" } },
      });
      await this.prisma.cat.updateMany({
        where: { id: catId, status: "ACTIVE" },
        data: { membershipStatus: activeCount > 0 ? "ACTIVE" : "INACTIVE" },
      });
    }
  }

  private serialize(sub: SubWithIncludes) {
    return {
      id: sub.id,
      status: sub.status,
      price: Number(sub.price), // monthly rate snapshot
      currency: sub.currency,
      termMonths: sub.termMonths,
      startedAt: sub.startedAt,
      endsAt: sub.endsAt,
      cancelAtTermEnd: sub.cancelAtTermEnd,
      cancelledAt: sub.cancelledAt,
      pausedAt: sub.pausedAt,
      nextBillingAt: sub.nextBillingAt,
      nextDeliveryAt: sub.nextDeliveryAt,
      plan: sub.plan
        ? { tier: sub.plan.tier, nameEn: sub.plan.nameEn, nameAr: sub.plan.nameAr }
        : null,
      cats: sub.cats.map((c) => ({ id: c.cat.id, name: c.cat.name, catIdNumber: c.cat.catIdNumber })),
      customer: {
        id: sub.user.id,
        email: sub.user.email,
        name: [sub.user.firstName, sub.user.lastName].filter(Boolean).join(" ") || sub.user.email,
      },
      recentEvents: sub.events.map((e) => ({ type: e.type, metadata: e.metadata, at: e.createdAt })),
    };
  }
}

const subInclude = {
  plan: { select: { tier: true, nameEn: true, nameAr: true } },
  cats: { include: { cat: { select: { id: true, name: true, catIdNumber: true } } } },
  user: { select: { id: true, email: true, firstName: true, lastName: true } },
  events: { orderBy: { createdAt: "desc" as const }, take: 10 },
} satisfies Prisma.SubscriptionInclude;

type SubWithIncludes = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
