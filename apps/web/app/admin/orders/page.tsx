"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, Skeleton, useToast } from "@moraqat/ui";
import { IlloCan } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { orderStatusLabel, fmtDate, fmtNum } from "@/app/admin/_components/i18n";
import { ALLOWED_ORDER_TRANSITIONS, DESTRUCTIVE_ORDER_STATUSES } from "@/app/admin/_components/order-transitions";

interface OrderRow {
  orderNumber: string; status: string; source: string; grandTotal: number;
  currency: string; itemCount: number; customer: string; customerId: string; placedAt: string;
}
interface OrdersResp { items: OrderRow[]; pagination: { total: number; page: number; totalPages: number } }

const STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED"];

export default function AdminOrders() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const [filter, setFilter] = React.useState("");
  const [page, setPage] = React.useState(1);
  // The transition awaiting confirmation (every change confirms; destructive
  // ones additionally collect a reason for the audit trail).
  const [pending, setPending] = React.useState<{ orderNumber: string; from: string; to: string } | null>(null);

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
    mutationFn: ({ orderNumber, status, reason }: { orderNumber: string; status: string; reason?: string }) =>
      authedFetch(`/admin/orders/${orderNumber}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      setPending(null);
      toast({
        title: isAr ? "تم تحديث حالة الطلب" : "Order status updated",
        description: `${v.orderNumber} → ${orderStatusLabel(v.status, isAr)}`,
        variant: "success",
      });
    },
    onError: (e: Error) => {
      setPending(null);
      toast({ title: isAr ? "تعذّر تحديث الحالة" : "Couldn’t update status", description: e.message, variant: "error" });
    },
  });

  const openDetail = (orderNumber: string) => router.push(`/admin/orders/${orderNumber}`);
  const isDestructive = pending ? DESTRUCTIVE_ORDER_STATUSES.includes(pending.to) : false;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "الطلبات" : "Orders"}</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (isAr ? `${fmtNum(data.pagination.total, isAr)} إجمالاً` : `${fmtNum(data.pagination.total, isAr)} total`) : "—"}
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
                data.items.map((o) => {
                  const nextStatuses = ALLOWED_ORDER_TRANSITIONS[o.status] ?? [];
                  return (
                    <tr
                      key={o.orderNumber}
                      onClick={() => openDetail(o.orderNumber)}
                      onKeyDown={(e) => { if (e.key === "Enter") openDetail(o.orderNumber); }}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/40"
                    >
                      <td className="px-4 py-3 font-medium" dir="ltr">{o.orderNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground">{o.customer}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.placedAt, isAr, { day: "numeric", month: "short" })}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{o.itemCount}</td>
                      <td className="px-4 py-3 text-end font-semibold tabular-nums">{fmtNum(o.grandTotal, isAr)} {o.currency}</td>
                      {/* The select must not trigger the row navigation. */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <select
                          value={o.status}
                          aria-label={isAr ? `حالة الطلب ${o.orderNumber}` : `Status of order ${o.orderNumber}`}
                          onChange={(e) => setPending({ orderNumber: o.orderNumber, from: o.status, to: e.target.value })}
                          disabled={changeStatus.isPending || nextStatuses.length === 0}
                          className="rounded-lg border border-input bg-background px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                        >
                          {/* Only sensible transitions are offered — no DELIVERED → PENDING. */}
                          <option value={o.status}>{orderStatusLabel(o.status, isAr)}</option>
                          {nextStatuses.map((s) => <option key={s} value={s}>{orderStatusLabel(s, isAr)}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })
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

      <ConfirmDialog
        open={!!pending}
        onClose={() => setPending(null)}
        onConfirm={(reason) => pending && changeStatus.mutate({ orderNumber: pending.orderNumber, status: pending.to, reason })}
        pending={changeStatus.isPending}
        isAr={isAr}
        destructive={isDestructive}
        withReason={isDestructive}
        title={
          pending
            ? isAr
              ? `تغيير الحالة إلى «${orderStatusLabel(pending.to, isAr)}»؟`
              : `Move this order to “${orderStatusLabel(pending.to, isAr)}”?`
            : ""
        }
        description={
          pending
            ? isAr
              ? `الطلب ${pending.orderNumber}: من «${orderStatusLabel(pending.from, isAr)}» إلى «${orderStatusLabel(pending.to, isAr)}». يُسجَّل هذا الإجراء في سجل التدقيق.`
              : `Order ${pending.orderNumber}: from “${orderStatusLabel(pending.from, isAr)}” to “${orderStatusLabel(pending.to, isAr)}”. This action is recorded in the audit log.`
            : undefined
        }
        confirmLabel={pending ? (isAr ? "تأكيد التغيير" : "Confirm change") : ""}
        reasonLabel={isAr ? "سبب التغيير (يُسجَّل)" : "Reason for the change (audited)"}
      />
    </div>
  );
}
