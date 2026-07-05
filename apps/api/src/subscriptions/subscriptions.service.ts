import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { commerceEnabled } from "../common/config/features";
import type { CreateSubscriptionDto } from "./dto/subscription.dto";

const INTERVAL_DAYS: Record<string, number> = {
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
};

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateSubscriptionDto) {
    // Community Mode: paid activation is disabled. Membership must never flip to
    // ACTIVE without a captured payment, so subscription creation is refused
    // outright until commerce goes live. (Defense-in-depth behind @Commercial.)
    if (!commerceEnabled()) {
      throw new ForbiddenException({
        code: "MEMBERSHIPS_COMING_SOON",
        message: "Memberships are launching soon.",
      });
    }

    // Validate cats belong to the user.
    const cats = await this.prisma.cat.findMany({
      where: { id: { in: dto.catIds }, userId, deletedAt: null },
      select: { id: true },
    });
    if (cats.length !== dto.catIds.length) {
      throw new BadRequestException("One or more cats were not found");
    }

    const intervalDays = this.resolveIntervalDays(dto.interval, dto.intervalDays);

    // Price = plan base + à-la-carte items.
    let price = 0;
    let plan = null;
    if (dto.planId) {
      plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
      if (!plan) throw new BadRequestException("Plan not found");
      price += Number(plan.basePrice);
    }

    const items = dto.items ?? [];
    if (items.length) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, isActive: true, deletedAt: null },
      });
      const priceById = new Map(products.map((p) => [p.id, Number(p.price)]));
      for (const it of items) {
        const unit = priceById.get(it.productId);
        if (unit === undefined) throw new BadRequestException(`Product ${it.productId} unavailable`);
        price += unit * it.quantity;
      }
    }

    if (!dto.planId && items.length === 0) {
      throw new BadRequestException("A subscription needs a plan or at least one item");
    }

    const now = new Date();
    const next = addDays(now, intervalDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        planId: dto.planId,
        addressId: dto.addressId,
        status: "ACTIVE",
        interval: dto.interval,
        intervalDays: dto.interval === "CUSTOM" ? intervalDays : null,
        price: new Prisma.Decimal(round(price)),
        isGift: dto.isGift ?? false,
        giftRecipient: dto.giftRecipient,
        startedAt: now,
        nextBillingAt: next,
        nextDeliveryAt: next,
        cats: { create: dto.catIds.map((catId) => ({ catId })) },
        items: items.length
          ? {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: new Prisma.Decimal(0), // snapshot set below
              })),
            }
          : undefined,
        events: { create: { type: "created", metadata: { intervalDays } } },
      },
      include: subInclude,
    });

    // Snapshot item prices (kept simple & explicit).
    for (const it of items) {
      const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
      if (product) {
        await this.prisma.subscriptionItem.updateMany({
          where: { subscriptionId: sub.id, productId: it.productId },
          data: { unitPrice: product.price },
        });
      }
    }

    // Activate membership for the covered cats (#9).
    await this.syncCatsMembership(dto.catIds);

    return this.serialize(await this.reload(sub.id));
  }

  async findAll(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId },
      include: subInclude,
      orderBy: { createdAt: "desc" },
    });
    return subs.map((s) => this.serialize(s));
  }

  async findOne(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    return this.serialize(sub);
  }

  async pause(userId: string, id: string, until?: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "ACTIVE") throw new BadRequestException("Only active subscriptions can be paused");
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "PAUSED",
        pausedUntil: until ? new Date(until) : null,
        events: { create: { type: "paused", metadata: { until: until ?? null } } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  async resume(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "PAUSED") throw new BadRequestException("Only paused subscriptions can be resumed");
    const next = addDays(new Date(), this.resolveIntervalDays(sub.interval, sub.intervalDays));
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedUntil: null,
        nextBillingAt: next,
        nextDeliveryAt: next,
        events: { create: { type: "resumed" } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  async skip(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "ACTIVE") throw new BadRequestException("Only active subscriptions can skip");
    const days = this.resolveIntervalDays(sub.interval, sub.intervalDays);
    const base = sub.nextBillingAt ?? new Date();
    const next = addDays(base, days);
    await this.prisma.subscription.update({
      where: { id },
      data: {
        nextBillingAt: next,
        nextDeliveryAt: next,
        events: { create: { type: "skipped", metadata: { skippedTo: next.toISOString() } } },
      },
    });
    return this.serialize(await this.reload(id));
  }

  async cancel(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status === "CANCELLED") throw new BadRequestException("Already cancelled");
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        events: { create: { type: "cancelled" } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  /**
   * Recompute membership for the given cats (#9): a cat's membership is ACTIVE
   * iff it's covered by at least one ACTIVE subscription; otherwise INACTIVE.
   * The Cat ID itself never changes — only the membership status gates.
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

  private resolveIntervalDays(interval: string, custom?: number | null): number {
    if (interval === "CUSTOM") {
      if (!custom) throw new BadRequestException("intervalDays is required for CUSTOM interval");
      return custom;
    }
    return INTERVAL_DAYS[interval] ?? 30;
  }

  private async owned(userId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: subInclude,
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    return sub;
  }

  private reload(id: string) {
    return this.prisma.subscription.findUniqueOrThrow({ where: { id }, include: subInclude });
  }

  private serialize(sub: SubWithIncludes) {
    return {
      id: sub.id,
      status: sub.status,
      interval: sub.interval,
      intervalDays: sub.intervalDays,
      price: Number(sub.price),
      currency: sub.currency,
      isGift: sub.isGift,
      startedAt: sub.startedAt,
      nextBillingAt: sub.nextBillingAt,
      nextDeliveryAt: sub.nextDeliveryAt,
      pausedUntil: sub.pausedUntil,
      plan: sub.plan ? { tier: sub.plan.tier, nameEn: sub.plan.nameEn, nameAr: sub.plan.nameAr } : null,
      cats: sub.cats.map((c) => ({ id: c.cat.id, name: c.cat.name })),
      items: sub.items.map((i) => ({
        productId: i.productId,
        nameEn: i.product.nameEn,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      recentEvents: sub.events.slice(0, 5).map((e) => ({ type: e.type, at: e.createdAt })),
    };
  }
}

const subInclude = {
  plan: true,
  cats: { include: { cat: { select: { id: true, name: true } } } },
  items: { include: { product: { select: { nameEn: true } } } },
  events: { orderBy: { createdAt: "desc" as const }, take: 5 },
} satisfies Prisma.SubscriptionInclude;

type SubWithIncludes = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
const round = (n: number) => Math.round(n * 100) / 100;
