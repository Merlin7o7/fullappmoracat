import { Injectable } from "@nestjs/common";
import type { Prisma } from "@moraqat/db";
import { FOUNDING_MEMBER_LIMIT } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { commerceEnabled } from "../common/config/features";

/**
 * What counts as money (honest numbers, R021/R006).
 *
 * Revenue used to be "every order that isn't cancelled, failed or returned".
 * That counted a PENDING order — a checkout someone opened and never paid — as
 * income, and it counted every payment the MOCK provider "captured" while the
 * team tested the rails. So with commerce switched off and not one riyal
 * collected, the dashboard still reported revenue.
 *
 * Money is now counted where money is: a Payment row a real PSP captured, from
 * a member who isn't staff, net of its refunds.
 *   - CAPTURED / PARTIALLY_REFUNDED only; a fully REFUNDED payment nets to zero.
 *   - The mock provider stamps every reference `mock_…` / `mockpay_…`
 *     (payments/mock-payment.provider.ts) — those are rehearsals, not revenue.
 */
const REAL_MONEY: Prisma.PaymentWhereInput = {
  status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] },
  providerRef: { not: null },
  NOT: { providerRef: { startsWith: "mock" } },
  order: { user: { isStaff: false } },
};

/** The rehearsals: captured, but by the mock provider or on a staff account. */
const TEST_MONEY: Prisma.PaymentWhereInput = {
  status: { in: ["CAPTURED", "PARTIALLY_REFUNDED"] },
  OR: [{ providerRef: null }, { providerRef: { startsWith: "mock" } }, { order: { user: { isStaff: true } } }],
};

/** A membership a real member really paid for — the only kind MRR may count. */
const REAL_SUBSCRIPTION: Prisma.SubscriptionWhereInput = {
  user: { isStaff: false },
  orders: { some: { payments: { some: REAL_MONEY } } },
};

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Census yield (MRC-GTM-001 §1–§2).
   *
   * Phase 0's whole operating question is "which stand is producing cats?" —
   * the strategy says kill or move any stand under 20 IDs/month, and that
   * decision needs per-source counts, not revenue. Registrations without a
   * `?src=` are reported honestly as "direct" rather than being folded into
   * whichever stand happens to sort first.
   */
  async census() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400_000);
    // A clinic-created cat is not a registration until its owner claims it.
    const live = { deletedAt: null, claimStatus: "CLAIMED" as const };

    const [total, last30, founding, bySource, bySource30, recent] = await Promise.all([
      this.prisma.cat.count({ where: live }),
      this.prisma.cat.count({ where: { ...live, createdAt: { gte: d30 } } }),
      // Founding places issued, by the high-water ordinal — NOT by a live count,
      // because a deleted founding cat does not reopen its place.
      this.prisma.cat.aggregate({ _max: { catNumber: true } }),
      this.prisma.cat.groupBy({
        by: ["sourceCode"],
        where: live,
        _count: { _all: true },
        orderBy: { _count: { sourceCode: "desc" } },
      }),
      this.prisma.cat.groupBy({
        by: ["sourceCode"],
        where: { ...live, createdAt: { gte: d30 } },
        _count: { _all: true },
      }),
      this.prisma.cat.findMany({
        where: live,
        orderBy: { catNumber: "desc" },
        take: 10,
        select: { catNumber: true, name: true, catIdNumber: true, sourceCode: true, createdAt: true },
      }),
    ]);

    const per30 = new Map(bySource30.map((r) => [r.sourceCode ?? "", r._count._all]));

    return {
      registered: total,
      registeredLast30Days: last30,
      foundingLimit: FOUNDING_MEMBER_LIMIT,
      foundingIssued: Math.min(founding._max.catNumber ?? 0, FOUNDING_MEMBER_LIMIT),
      sources: bySource.map((row) => ({
        // "direct" is a real answer, not a missing one: it means the person
        // arrived without a stand code and we should not pretend otherwise.
        source: row.sourceCode ?? "direct",
        total: row._count._all,
        last30Days: per30.get(row.sourceCode ?? "") ?? 0,
      })),
      recent,
    };
  }

  async dashboard() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400_000);
    const d14 = new Date(now.getTime() - 14 * 86400_000);

    const [
      realPayments, testPayments,
      totalCustomers, newCustomers30,
      activeSubs, pausedSubs, pastDueSubs, endedSubs, scheduledCancels,
      statusGroups, topItems, recentOrders,
    ] = await Promise.all([
      // Every real payment that took money. Small at this stage, and summing in
      // JS lets refunds net off per payment and bucket by CAPTURE date — the day
      // the money actually arrived, not the day a basket was opened.
      this.prisma.payment.findMany({
        where: REAL_MONEY,
        select: { amount: true, capturedAt: true, createdAt: true, orderId: true, refunds: { select: { amount: true } } },
      }),
      this.prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: TEST_MONEY }),
      this.prisma.user.count({ where: { isStaff: false } }),
      this.prisma.user.count({ where: { isStaff: false, createdAt: { gte: d30 } } }),
      this.prisma.subscription.findMany({ where: { ...REAL_SUBSCRIPTION, status: "ACTIVE" }, select: { price: true, cancelAtTermEnd: true } }),
      this.prisma.subscription.count({ where: { ...REAL_SUBSCRIPTION, status: "PAUSED" } }),
      this.prisma.subscription.count({ where: { ...REAL_SUBSCRIPTION, status: "PAST_DUE" } }),
      // Ended = a membership that really ran and then stopped. `startedAt` is
      // what separates it from an abandoned checkout: the lifecycle job marks a
      // stale DRAFT as CANCELLED too, and that was never a member to lose.
      this.prisma.subscription.count({
        where: { ...REAL_SUBSCRIPTION, status: { in: ["CANCELLED", "EXPIRED"] }, startedAt: { not: null } },
      }),
      this.prisma.subscription.count({ where: { ...REAL_SUBSCRIPTION, status: "ACTIVE", cancelAtTermEnd: true } }),
      this.prisma.order.groupBy({ by: ["status"], where: { user: { isStaff: false } }, _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ["productId", "nameEn"],
        where: { order: { payments: { some: REAL_MONEY } } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      this.prisma.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 8,
        include: {
          user: { select: { email: true, firstName: true, isStaff: true } },
          payments: { select: { status: true, providerRef: true } },
        },
      }),
    ]);

    const net = (p: { amount: unknown; refunds: { amount: unknown }[] }) =>
      Math.max(0, Number(p.amount) - p.refunds.reduce((sum, r) => sum + Number(r.amount), 0));
    const paidAt = (p: { capturedAt: Date | null; createdAt: Date }) => p.capturedAt ?? p.createdAt;
    const round2 = (n: number) => Math.round(n * 100) / 100;

    const revenueTotal = realPayments.reduce((sum, p) => sum + net(p), 0);
    const revenue30d = realPayments.filter((p) => paidAt(p) >= d30).reduce((sum, p) => sum + net(p), 0);
    const paidOrders = new Set(realPayments.map((p) => p.orderId));
    const paidOrders30 = new Set(realPayments.filter((p) => paidAt(p) >= d30).map((p) => p.orderId));

    const mrr = activeSubs.reduce((sum, sub) => sum + Number(sub.price), 0);
    const everRan = activeSubs.length + pausedSubs + pastDueSubs + endedSubs;
    const churnRate = everRan > 0 ? endedSubs / everRan : 0;

    // Bucket net revenue into the last 14 days, by the day it was captured.
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      byDay.set(new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10), 0);
    }
    for (const p of realPayments) {
      const at = paidAt(p);
      if (at < d14) continue;
      const key = at.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, byDay.get(key)! + net(p));
    }

    return {
      // The switch itself, so the dashboard can say "commerce is off" in words
      // instead of showing a row of zeros that looks like a broken report.
      commerceEnabled: commerceEnabled(),
      kpis: {
        revenueTotal: round2(revenueTotal),
        revenue30d: round2(revenue30d),
        mrr: round2(mrr),
        arr: round2(mrr * 12),
        ordersTotal: paidOrders.size,
        orders30d: paidOrders30.size,
        activeSubscribers: activeSubs.length,
        pausedSubscribers: pausedSubs,
        pastDueSubscribers: pastDueSubs,
        scheduledCancels,
        totalCustomers,
        newCustomers30d: newCustomers30,
        aov: paidOrders.size > 0 ? round2(revenueTotal / paidOrders.size) : 0,
        churnRate: Math.round(churnRate * 1000) / 10, // percentage
      },
      // Money that moved only through the mock provider or a staff account.
      // Reported, never added: it is how a team knows the rails work, and it
      // must not be mistaken for income (R006 — honest by default).
      test: {
        payments: testPayments._count._all,
        total: round2(Number(testPayments._sum.amount ?? 0)),
      },
      revenueByDay: Array.from(byDay.entries()).map(([date, total]) => ({ date, total: round2(total) })),
      ordersByStatus: statusGroups.map((g) => ({ status: g.status, count: g._count._all })),
      topProducts: topItems.map((t) => ({
        productId: t.productId,
        name: t.nameEn,
        unitsSold: t._sum.quantity ?? 0,
        revenue: Number(t._sum.lineTotal ?? 0),
      })),
      recentOrders: recentOrders.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        grandTotal: Number(o.grandTotal),
        customer: o.user.firstName || o.user.email,
        placedAt: o.placedAt,
        // A test order is one that no real payment ever touched.
        test: o.user.isStaff || o.payments.every((pay) => !pay.providerRef || pay.providerRef.startsWith("mock")),
      })),
    };
  }
}
