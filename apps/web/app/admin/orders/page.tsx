"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Skeleton } from "@moraqat/ui";
import { IlloCan } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { orderStatusLabel, fmtDate, fmtNum } from "@/app/admin/_components/i18n";

interface OrderRow {
  orderNumber: string; status: string; source: string; grandTotal: number;
  currency: string; itemCount: number; customer: string; placedAt: string;
}
interface OrdersResp { items: OrderRow[]; pagination: { total: number; page: number; totalPages: number } }

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED"];

export default function AdminOrders() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => { setPage(1); }, [filter]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-orders", user?.id, filter, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (filter) qs.set("status", filter);
      return authedFetch<OrdersResp>(`/admin/orders?${qs.toString()}`);
    },
    enabled: !!user?.isStaff,
  });

  const changeStatus = useMutation({
    mutationFn: ({ orderNumber, status }: { orderNumber: string; status: string }) =>
      authedFetch(`/admin/orders/${orderNumber}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الطلبات" : "Orders"}</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (isAr ? `${data.pagination.total.toLocaleString("ar-SA")} إجمالاً` : `${data.pagination.total} total`) : "—"}
          </p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-full border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">{isAr ? "كل الحالات" : "All statuses"}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s, isAr)}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-start text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "الطلب" : "Order"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "العميل" : "Customer"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "التاريخ" : "Date"}</th>
                <th className="px-4 py-3 text-center font-medium">{isAr ? "العناصر" : "Items"}</th>
                <th className="px-4 py-3 text-end font-medium">{isAr ? "الإجمالي" : "Total"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">{isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn’t load. Try refreshing."}</td></tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium" dir="ltr">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.placedAt, isAr, { day: "numeric", month: "short" })}</td>
                    <td className="px-4 py-3 text-center tabular-nums">{o.itemCount}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">{fmtNum(o.grandTotal, isAr)} {o.currency}</td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => changeStatus.mutate({ orderNumber: o.orderNumber, status: e.target.value })}
                        disabled={changeStatus.isPending}
                        className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s, isAr)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground"><IlloCan tone="pink" className="mx-auto mb-3 h-10 w-auto opacity-80" />{isAr ? "لا توجد طلبات" : "No orders found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
      )}
    </div>
  );
}
