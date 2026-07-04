"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Skeleton } from "@moraqat/ui";
import { IlloCan } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";

interface OrderRow {
  orderNumber: string; status: string; source: string; grandTotal: number;
  currency: string; itemCount: number; customer: string; placedAt: string;
}
interface OrdersResp { items: OrderRow[]; pagination: { total: number } }

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED"];

export default function AdminOrders() {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = React.useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", user?.id, filter],
    queryFn: () => authedFetch<OrdersResp>(`/admin/orders${filter ? `?status=${filter}` : ""}`),
    enabled: !!user?.isStaff,
  });

  const changeStatus = useMutation({
    mutationFn: ({ orderNumber, status }: { orderNumber: string; status: string }) =>
      authedFetch(`/admin/orders/${orderNumber}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-orders"] }),
  });

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.pagination.total} total` : "—"}</p>
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="h-10 rounded-full border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-center font-medium">Items</th>
                <th className="px-4 py-3 text-end font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : data && data.items.length > 0 ? (
                data.items.map((o) => (
                  <tr key={o.orderNumber} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{o.customer}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.placedAt)}</td>
                    <td className="px-4 py-3 text-center">{o.itemCount}</td>
                    <td className="px-4 py-3 text-end font-semibold">{o.grandTotal} {o.currency}</td>
                    <td className="px-4 py-3">
                      <select
                        value={o.status}
                        onChange={(e) => changeStatus.mutate({ orderNumber: o.orderNumber, status: e.target.value })}
                        disabled={changeStatus.isPending}
                        className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring"
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                      </select>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground"><IlloCan tone="pink" className="mx-auto mb-3 h-10 w-auto opacity-80" />No orders found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

const label = (s: string) => s.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
