import { Injectable } from "@nestjs/common";
import type { OrderStatus } from "@moraqat/db";
import { FOUNDING_MEMBER_LIMIT } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Orders that never produced (or gave back) money. Revenue, AOV, order counts
 * and the 14-day chart must exclude these — a cancelled or failed order isn't
 * income, and a returned one was refunded (honest numbers, R021).
 */
const NON_REVENUE_STATUSES: OrderStatus[] = ["CANCELLED", "FAILED", "RETURNED"];

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
    // Exclude demo/quarantined cats, exactly as the public CensusService does —
    // the admin dashboard is the operating instrument for the same campaign, so
    // it must count the same population. A fictional demo cat inside these totals
    // is a false internal claim (R006).
    const live = { deletedAt: null, isDemo: false };

    const [total, last30, founding, bySource, bySource30, recent] = await Promise.all([
      this.prisma.cat.count({ where: live }),
      this.prisma.cat.count({ where: { ...live, createdAt: { gte: d30 } } }),
      // Founding places issued, by the high-water ordinal — NOT by a live count,
      // because a deleted founding cat does not reopen its place. Demo cats are
      // excluded so a quarantined fixture can't inflate the founding high-water.
      this.prisma.cat.aggregate({ _max: { catNumber: true }, where: { isDemo: false } }),
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
    const earned = { status: { notIn: NON_REVENUE_STATUSES } };

    const [
      revenueAll, revenue30, ordersAll, orders30,
      activeSubsAgg, totalCustomers, newCustomers30,
      cancelledSubs, activeSubsCount, statusGroups,
      topItems, recentOrders, revenueRows,
    ] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { grandTotal: true }, where: earned }),
      this.prisma.order.aggregate({ _sum: { grandTotal: true }, where: { ...earned, placedAt: { gte: d30 } } }),
      this.prisma.order.count({ where: earned }),
      this.prisma.order.count({ where: { ...earned, placedAt: { gte: d30 } } }),
      this.prisma.subscription.aggregate({ _sum: { price: true }, where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { isStaff: false } }),
      this.prisma.user.count({ where: { isStaff: false, createdAt: { gte: d30 } } }),
      this.prisma.subscription.count({ where: { status: "CANCELLED" } }),
      this.prisma.subscription.count({ where: { status: "ACTIVE" } }),
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ["productId", "nameEn"],
        where: { order: earned },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
      this.prisma.order.findMany({
        orderBy: { placedAt: "desc" },
        take: 8,
        include: { user: { select: { email: true, firstName: true } } },
      }),
      this.prisma.order.findMany({
        where: { ...earned, placedAt: { gte: d14 } },
        select: { grandTotal: true, placedAt: true },
      }),
    ]);

    const revenueTotal = Number(revenueAll._sum.grandTotal ?? 0);
    const ordersTotal = ordersAll;
    const mrr = Number(activeSubsAgg._sum.price ?? 0);
    const churnRate =
      activeSubsCount + cancelledSubs > 0
        ? cancelledSubs / (activeSubsCount + cancelledSubs)
        : 0;

    // Bucket revenue into the last 14 days.
    const byDay = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 86400_000).toISOString().slice(0, 10);
      byDay.set(day, 0);
    }
    for (const r of revenueRows) {
      const key = r.placedAt.toISOString().slice(0, 10);
      if (byDay.has(key)) byDay.set(key, byDay.get(key)! + Number(r.grandTotal));
    }

    return {
      kpis: {
        revenueTotal,
        revenue30d: Number(revenue30._sum.grandTotal ?? 0),
        mrr,
        arr: mrr * 12,
        ordersTotal,
        orders30d: orders30,
        activeSubscribers: activeSubsCount,
        totalCustomers,
        newCustomers30d: newCustomers30,
        aov: ordersTotal > 0 ? Math.round((revenueTotal / ordersTotal) * 100) / 100 : 0,
        churnRate: Math.round(churnRate * 1000) / 10, // percentage
      },
      revenueByDay: Array.from(byDay.entries()).map(([date, total]) => ({
        date,
        total: Math.round(total * 100) / 100,
      })),
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
      })),
    };
  }
}
