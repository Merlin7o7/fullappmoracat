"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, FileText } from "lucide-react";
import { Card, Skeleton, Button } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { QueryError } from "@/components/query-error";
import { IlloCan, IlloPaw } from "@/components/illustrations";

interface OrderRow {
  orderNumber: string;
  status: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  placedAt: string;
}

export default function OrdersPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => authedFetch<OrderRow[]>("/orders"),
    enabled: !!user,
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString(isAr ? "ar-SA" : "en-GB", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الطلبات" : "Orders"}</h1>
        <p className="text-sm text-muted-foreground">{isAr ? "سجلّ طلباتك وفواتيرك" : "Your order and invoice history"}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : data && data.length > 0 ? (
        <Card className="divide-y divide-border p-0">
          {data.map((o) => (
            <div key={o.orderNumber} className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" /></span>
                <div>
                  <p className="font-medium">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(o.placedAt)} · {o.itemCount} {isAr ? "عنصر" : "items"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={o.status} isAr={isAr} />
                <span className="font-display font-semibold">{o.grandTotal} {o.currency}</span>
                <Button variant="ghost" size="sm" aria-label="invoice"><FileText className="size-4" /></Button>
              </div>
            </div>
          ))}
        </Card>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloCan tone="pink" className="h-24 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "لا توجد طلبات بعد — العضويات والتوصيل على وشك الإطلاق" : "No orders yet — memberships & delivery are launching soon"}
          </p>
          <Link href="/portal/subscribe"><Button size="sm">{isAr ? "استعرض العضويات" : "Preview memberships"}</Button></Link>
        </Card>
      )}
    </div>
  );
}
