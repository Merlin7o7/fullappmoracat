import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 86400_000);
    const d14 = new Date(now.getTime() - 14 * 86400_000);

    const [
      revenueAll, revenue30, ordersAll, orders30,
      activeSubsAgg, totalCustomers, newCustomers30,
      cancelledSubs, activeSubsCount, statusGroups,
      topItems, recentOrders, revenueRows,
    ] = await Promise.all([
      this.prisma.order.aggregate({ _sum: { grandTotal: true } }),
      this.prisma.order.aggregate({ _sum: { grandTotal: true }, where: { placedAt: { gte: d30 } } }),
      this.prisma.order.count(),
      this.prisma.order.count({ where: { placedAt: { gte: d30 } } }),
      this.prisma.subscription.aggregate({ _sum: { price: true }, where: { status: "ACTIVE" } }),
      this.prisma.user.count({ where: { isStaff: false } }),
      this.prisma.user.count({ where: { isStaff: false, createdAt: { gte: d30 } } }),
      this.prisma.subscription.count({ where: { status: "CANCELLED" } }),
      this.prisma.subscription.count({ where: { status: "ACTIVE" } }),
      this.prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.orderItem.groupBy({
        by: ["productId", "nameEn"],
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
        where: { placedAt: { gte: d14 } },
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
