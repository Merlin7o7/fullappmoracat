"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, Cat, Wallet, Award, Truck, ArrowRight, CreditCard } from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { OrderStatusBadge } from "@/components/order-status-badge";

interface Overview {
  activeSubscription: null | {
    id: string;
    plan: { nameEn: string; nameAr: string; tier: string } | null;
    price: number;
    nextDeliveryAt: string | null;
    nextBillingAt: string | null;
  };
  stats: { orders: number; cats: number; walletBalance: number; loyaltyPoints: number; loyaltyTier: string; unreadNotifications: number };
  recentOrders: { orderNumber: string; status: string; grandTotal: number; placedAt: string }[];
}

export default function OverviewPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data, isLoading } = useQuery({
    queryKey: ["overview", user?.id],
    queryFn: () => authedFetch<Overview>("/account/overview"),
    enabled: !!user,
  });

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const stats = [
    { icon: Package, label: isAr ? "الطلبات" : "Orders", value: data?.stats.orders ?? 0 },
    { icon: Cat, label: isAr ? "القطط" : "Cats", value: data?.stats.cats ?? 0 },
    { icon: Wallet, label: isAr ? "المحفظة" : "Wallet", value: `${data?.stats.walletBalance ?? 0} SAR` },
    { icon: Award, label: isAr ? "النقاط" : "Points", value: data?.stats.loyaltyPoints ?? 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isAr ? `أهلاً${user?.firstName ? " " + user.firstName : ""}` : `Welcome back${user?.firstName ? ", " + user.firstName : ""}`}
        </h1>
        <p className="text-sm text-muted-foreground">{isAr ? "إليك ملخص حسابك" : "Here's your account at a glance"}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <span className="mb-3 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <s.icon className="size-5" />
            </span>
            {isLoading ? <Skeleton className="h-7 w-16" /> : <p className="font-display text-2xl font-bold">{s.value}</p>}
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Active subscription */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isAr ? "اشتراكك النشط" : "Active subscription"}</h2>
          <Link href="/portal/subscriptions"><Button variant="ghost" size="sm">{isAr ? "إدارة" : "Manage"} <ArrowRight className="size-4" /></Button></Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : data?.activeSubscription ? (
          <div className="flex flex-wrap items-center gap-6 rounded-xl bg-muted/50 p-4">
            <Badge>{data.activeSubscription.plan ? (isAr ? data.activeSubscription.plan.nameAr : data.activeSubscription.plan.nameEn) : (isAr ? "مخصص" : "Custom")}</Badge>
            <InfoBit icon={CreditCard} label={isAr ? "السعر" : "Price"} value={`${data.activeSubscription.price} SAR`} />
            <InfoBit icon={Truck} label={isAr ? "التوصيل القادم" : "Next delivery"} value={fmtDate(data.activeSubscription.nextDeliveryAt)} />
            <InfoBit icon={CreditCard} label={isAr ? "الفوترة القادمة" : "Next billing"} value={fmtDate(data.activeSubscription.nextBillingAt)} />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm text-muted-foreground">{isAr ? "لا يوجد اشتراك نشط بعد" : "No active subscription yet"}</p>
            <Link href="/#plans"><Button size="sm">{isAr ? "ابدأ اشتراكاً" : "Start a subscription"}</Button></Link>
          </div>
        )}
      </Card>

      {/* Recent orders */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">{isAr ? "أحدث الطلبات" : "Recent orders"}</h2>
          <Link href="/portal/orders"><Button variant="ghost" size="sm">{isAr ? "الكل" : "View all"} <ArrowRight className="size-4" /></Button></Link>
        </div>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : data && data.recentOrders.length > 0 ? (
          <div className="divide-y divide-border">
            {data.recentOrders.map((o) => (
              <div key={o.orderNumber} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.placedAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <OrderStatusBadge status={o.status} isAr={isAr} />
                  <span className="font-display font-semibold">{o.grandTotal} SAR</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">{isAr ? "لا توجد طلبات بعد" : "No orders yet"}</p>
        )}
      </Card>
    </div>
  );
}

function InfoBit({ icon: Icon, label, value }: { icon: typeof Truck; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}
