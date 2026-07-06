"use client";

import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Repeat, Users, ShoppingBag, Wallet, Percent, Cat, ListChecks } from "lucide-react";
import { Card, Skeleton, AnimatedCounter } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { QueryError } from "@/components/query-error";

interface Dashboard {
  kpis: {
    revenueTotal: number; revenue30d: number; mrr: number; arr: number;
    ordersTotal: number; orders30d: number; activeSubscribers: number;
    totalCustomers: number; newCustomers30d: number; aov: number; churnRate: number;
  };
  revenueByDay: { date: string; total: number }[];
  ordersByStatus: { status: string; count: number }[];
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[];
  recentOrders: { orderNumber: string; status: string; grandTotal: number; customer: string; placedAt: string }[];
}

export default function AdminDashboard() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const sar = isAr ? " ر.س" : " SAR";
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-dashboard", user?.id],
    queryFn: () => authedFetch<Dashboard>("/admin/dashboard"),
    enabled: !!user?.isStaff,
  });

  // Community-Mode metrics — the live product right now (commerce KPIs read 0
  // until payments launch, so lead with what's actually happening).
  const community = useQuery({
    queryKey: ["admin-community-stats", user?.id],
    queryFn: async () => {
      const [pub, waitlist] = await Promise.all([
        authedFetch<{ pagination: { total: number } }>("/admin/community/cats?filter=public&page=1"),
        authedFetch<{ pagination: { total: number } }>("/admin/community/waitlist?page=1"),
      ]);
      return { publicCats: pub.pagination.total, waitlist: waitlist.pagination.total };
    },
    enabled: !!user?.isStaff,
  });

  const kpis = data?.kpis;
  const commStats = [
    { icon: Cat, label: isAr ? "قطط عامة" : "Public cats", num: community.data?.publicCats },
    { icon: ListChecks, label: isAr ? "قائمة انتظار العضويات" : "Membership waitlist", num: community.data?.waitlist },
    { icon: Users, label: isAr ? "إجمالي الأعضاء" : "Total members", num: data?.kpis.totalCustomers },
  ];
  const cards = [
    { icon: Wallet, label: isAr ? "إجمالي الإيرادات" : "Total revenue", num: kpis?.revenueTotal, suffix: sar, sub: kpis ? (isAr ? `${fmt(kpis.revenue30d)} آخر ٣٠ يوماً` : `${fmt(kpis.revenue30d)} last 30d`) : "" },
    { icon: Repeat, label: isAr ? "الإيراد الشهري المتكرر" : "MRR", num: kpis?.mrr, suffix: sar, sub: kpis ? (isAr ? `${fmt(kpis.arr)} سنوياً` : `${fmt(kpis.arr)} ARR`) : "" },
    { icon: ShoppingBag, label: isAr ? "الطلبات" : "Orders", num: kpis?.ordersTotal, sub: kpis ? (isAr ? `متوسط الطلب ${kpis.aov} ر.س` : `AOV ${kpis.aov} SAR`) : "" },
    { icon: Users, label: isAr ? "العملاء" : "Customers", num: kpis?.totalCustomers, sub: kpis ? (isAr ? `+${kpis.newCustomers30d} آخر ٣٠ يوماً` : `+${kpis.newCustomers30d} last 30d`) : "" },
    { icon: TrendingUp, label: isAr ? "الاشتراكات النشطة" : "Active subs", num: kpis?.activeSubscribers, sub: isAr ? "متكررة" : "recurring" },
    { icon: Percent, label: isAr ? "معدل التسرب" : "Churn", num: kpis?.churnRate, suffix: "%", decimals: 1, sub: isAr ? "من الاشتراكات" : "of subscriptions" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "لوحة التحكم" : "Dashboard"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "أداء المنصة في لمحة" : "Platform at a glance"}</p>
      </div>

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <>

      {/* Community-Mode strip — the live product (commerce KPIs below read 0
          until memberships launch). */}
      <div className="grid grid-cols-3 gap-4">
        {commStats.map((c) => (
          <Card key={c.label} className="p-5">
            <span className="mb-3 grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><c.icon className="size-4" /></span>
            {community.isLoading || c.num == null ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="font-display text-2xl font-bold tabular"><AnimatedCounter value={c.num} /></p>
            )}
            <p className="text-sm text-muted-foreground">{c.label}</p>
          </Card>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        {isAr
          ? "مقاييس المبيعات أدناه ستتحرك عند إطلاق العضويات المدفوعة (الوضع الحالي: مجتمعي)."
          : "The sales metrics below activate when paid memberships launch (current mode: Community)."}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.label} className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-foreground/5 text-foreground"><c.icon className="size-4" /></span>
            </div>
            {isLoading || c.num == null ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <p className="font-display text-2xl font-bold tabular">
                <AnimatedCounter value={c.num} decimals={c.decimals ?? 0} suffix={c.suffix ?? ""} />
              </p>
            )}
            <p className="text-sm text-muted-foreground">{c.label}</p>
            {c.sub && <p className="mt-1 text-xs text-muted-foreground">{c.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <Card className="p-6 lg:col-span-2">
          <h2 className="mb-4 font-display font-semibold">{isAr ? "الإيرادات — آخر ١٤ يوماً" : "Revenue — last 14 days"}</h2>
          {isLoading || !data ? <Skeleton className="h-40 w-full" /> : <RevenueChart data={data.revenueByDay} />}
        </Card>

        {/* Orders by status */}
        <Card className="p-6">
          <h2 className="mb-4 font-display font-semibold">{isAr ? "الطلبات حسب الحالة" : "Orders by status"}</h2>
          {isLoading || !data ? <Skeleton className="h-40 w-full" /> : (
            <div className="space-y-2">
              {data.ordersByStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between">
                  <OrderStatusBadge status={s.status} isAr={isAr} />
                  <span className="font-medium">{s.count}</span>
                </div>
              ))}
              {data.ordersByStatus.length === 0 && <p className="text-sm text-muted-foreground">{isAr ? "لا توجد طلبات بعد" : "No orders yet"}</p>}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top products */}
        <Card className="p-6">
          <h2 className="mb-4 font-display font-semibold">{isAr ? "أفضل المنتجات" : "Top products"}</h2>
          {isLoading || !data ? <Skeleton className="h-32 w-full" /> : (
            <div className="divide-y divide-border">
              {data.topProducts.map((p, i) => (
                <div key={p.productId} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-6 place-items-center rounded-full bg-muted text-xs font-semibold">{i + 1}</span>
                    <span className="text-sm">{p.name}</span>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-medium">{fmt(p.revenue)}{sar}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? `${p.unitsSold} مبيعاً` : `${p.unitsSold} sold`}</p>
                  </div>
                </div>
              ))}
              {data.topProducts.length === 0 && <p className="text-sm text-muted-foreground">{isAr ? "لا مبيعات بعد" : "No sales yet"}</p>}
            </div>
          )}
        </Card>

        {/* Recent orders */}
        <Card className="p-6">
          <h2 className="mb-4 font-display font-semibold">{isAr ? "أحدث الطلبات" : "Recent orders"}</h2>
          {isLoading || !data ? <Skeleton className="h-32 w-full" /> : (
            <div className="divide-y divide-border">
              {data.recentOrders.map((o) => (
                <div key={o.orderNumber} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium" dir="ltr">{o.orderNumber}</p>
                    <p className="text-xs text-muted-foreground">{o.customer}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <OrderStatusBadge status={o.status} isAr={isAr} />
                    <span className="text-sm font-semibold">{fmt(o.grandTotal)}{sar}</span>
                  </div>
                </div>
              ))}
              {data.recentOrders.length === 0 && <p className="text-sm text-muted-foreground">{isAr ? "لا توجد طلبات بعد" : "No orders yet"}</p>}
            </div>
          )}
        </Card>
      </div>
        </>
      )}
    </div>
  );
}

function RevenueChart({ data }: { data: { date: string; total: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex h-40 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.date} className="group flex flex-1 flex-col items-center gap-1">
          <div className="relative w-full flex-1 flex items-end">
            <div
              className="w-full rounded-t bg-primary/80 transition-all hover:bg-primary"
              style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }}
              title={`${d.date}: ${d.total} SAR`}
            />
          </div>
          <span className="text-[9px] text-muted-foreground">{d.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
