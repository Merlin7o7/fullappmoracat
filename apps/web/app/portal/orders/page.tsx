"use client";

// ════════════════════════════════════════════════════════════════════════
//  Orders — history + a working invoice view (R024: receipts, instantly).
//
//  The invoice button opens the real order detail in a dialog: lines,
//  subtotal, VAT broken out honestly (0% while not VAT-registered — shown,
//  never hidden), grand total, and the payment rail. Money renders through
//  lib/money everywhere (R110).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Package, FileText } from "lucide-react";
import { Card, Skeleton, Button, Dialog } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { formatSAR, formatAmount } from "@/lib/money";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { QueryError } from "@/components/query-error";
import { MembershipsClosedNotice } from "@/components/membership";
import { commerceEnabled } from "@/lib/features";
import { IlloCan, IlloPaw } from "@/components/illustrations";

interface OrderRow {
  orderNumber: string;
  status: string;
  grandTotal: number;
  currency: string;
  itemCount: number;
  placedAt: string;
}

interface OrderDetail {
  orderNumber: string;
  status: string;
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  placedAt: string;
  items: { nameEn: string; nameAr: string; quantity: number; unitPrice: number; lineTotal: number }[];
  payment: { provider: string; status: string; amount: number; capturedAt: string | null } | null;
  invoice: { invoiceNumber: string; status: string; grandTotal: number; issuedAt: string } | null;
}

const PROVIDER_LABEL: Record<string, { en: string; ar: string }> = {
  TAMARA: { en: "Tamara", ar: "تمارا" },
  MADA: { en: "mada", ar: "مدى" },
  APPLE_PAY: { en: "Apple Pay", ar: "أبل باي" },
  STC_PAY: { en: "STC Pay", ar: "إس تي سي باي" },
  MOCK: { en: "Test payment", ar: "دفع تجريبي" },
};

export default function OrdersPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [openOrder, setOpenOrder] = React.useState<string | null>(null);
  // Hidden from nav in Community Mode but still URL-reachable. Nothing has ever
  // been sold, so no total and no "VAT (15%)" line may render (R040).
  const commerce = commerceEnabled();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: () => authedFetch<OrderRow[]>("/orders"),
    enabled: !!user && commerce,
  });

  const detail = useQuery({
    queryKey: ["order-detail", openOrder],
    queryFn: () => authedFetch<OrderDetail>(`/orders/${openOrder}`),
    enabled: !!user && !!openOrder && commerce,
    staleTime: 60_000,
  });

  const fmtDate = (d: string) =>
    formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" });

  const inv = detail.data;
  const provider = inv?.payment ? PROVIDER_LABEL[inv.payment.provider] ?? { en: inv.payment.provider, ar: inv.payment.provider } : null;

  // Every hook has run — safe to swap the commercial body for the honest one.
  if (!commerce) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "الطلبات" : "Orders"}</h1>
        </div>
        <MembershipsClosedNotice
          isAr={isAr}
          body={
            isAr
              ? "ما فتحنا العضويات بعد، فما فيه طلبات ولا فواتير. أول ما نفتح، كل طلب وفاتورة يوصلك هنا."
              : "Memberships aren't open yet, so there are no orders or invoices. The moment we open, every one of them lands here."
          }
        />
      </div>
    );
  }

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
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Package className="size-5" aria-hidden /></span>
                <div>
                  <p className="font-medium" dir="ltr">{o.orderNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(o.placedAt)} · {formatAmount(o.itemCount, isAr)} {isAr ? "عنصر" : o.itemCount === 1 ? "item" : "items"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <OrderStatusBadge status={o.status} isAr={isAr} />
                <span className="font-display font-semibold tabular" dir="ltr">{formatSAR(o.grandTotal, isAr)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={isAr ? `عرض فاتورة الطلب ${o.orderNumber}` : `View invoice for order ${o.orderNumber}`}
                  onClick={() => setOpenOrder(o.orderNumber)}
                >
                  <FileText className="size-4" aria-hidden />
                </Button>
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
            {isAr ? "لا توجد طلبات بعد — أول صندوق يبدأ من باقة قطك" : "No orders yet — your first box starts with your cat's plan"}
          </p>
          <Link href="/portal/subscribe"><Button size="sm">{isAr ? "ابنِ باقة قطك" : "Build your cat's plan"}</Button></Link>
        </Card>
      )}

      {/* ── Invoice view — the receipt, honest to the halala (R024/R021) ───── */}
      <Dialog
        open={!!openOrder}
        onClose={() => setOpenOrder(null)}
        title={isAr ? "الفاتورة" : "Invoice"}
        description={openOrder ?? undefined}
      >
        {detail.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : detail.isError ? (
          <QueryError isAr={isAr} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
        ) : inv ? (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{isAr ? "رقم الطلب" : "Order number"}</p>
                <p className="font-medium" dir="ltr">{inv.orderNumber}</p>
              </div>
              <div className="text-end">
                <p className="text-xs text-muted-foreground">{isAr ? "التاريخ" : "Date"}</p>
                <p className="font-medium">{fmtDate(inv.placedAt)}</p>
              </div>
            </div>

            {inv.invoice && (
              <p className="text-xs text-muted-foreground">
                {isAr ? "رقم الفاتورة: " : "Invoice no.: "}
                <span dir="ltr">{inv.invoice.invoiceNumber}</span>
              </p>
            )}

            {inv.items.length > 0 && (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {inv.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 p-3">
                    <span className="min-w-0">
                      <span className="block truncate">{isAr ? it.nameAr : it.nameEn}</span>
                      <span className="text-xs text-muted-foreground tabular" dir="ltr">×{it.quantity}</span>
                    </span>
                    <span className="shrink-0 tabular" dir="ltr">{formatSAR(it.lineTotal, isAr)}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-1.5 rounded-xl bg-muted/50 p-4">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{isAr ? "المجموع الفرعي" : "Subtotal"}</span>
                <span className="tabular" dir="ltr">{formatSAR(inv.subtotal, isAr)}</span>
              </div>
              {inv.discountTotal > 0 && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isAr ? "الخصم" : "Discount"}</span>
                  <span className="tabular" dir="ltr">−{formatSAR(inv.discountTotal, isAr)}</span>
                </div>
              )}
              {inv.shippingTotal > 0 && (
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>{isAr ? "الشحن" : "Shipping"}</span>
                  <span className="tabular" dir="ltr">{formatSAR(inv.shippingTotal, isAr)}</span>
                </div>
              )}
              {/* VAT shown honestly even at zero — the member sees the whole truth. */}
              <div className="flex items-center justify-between text-muted-foreground">
                <span>
                  {inv.taxTotal > 0
                    ? isAr ? "ضريبة القيمة المضافة (١٥٪)" : "VAT (15%)"
                    : isAr ? "ضريبة القيمة المضافة (٠٪)" : "VAT (0%)"}
                </span>
                <span className="tabular" dir="ltr">{formatSAR(inv.taxTotal, isAr)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-display font-bold">
                <span>{isAr ? "الإجمالي" : "Total"}</span>
                <span className="tabular" dir="ltr">{formatSAR(inv.grandTotal, isAr)}</span>
              </div>
            </div>

            {provider && (
              <p className="text-xs text-muted-foreground">
                {isAr ? `الدفع عبر ${provider.ar}` : `Paid via ${provider.en}`}
              </p>
            )}
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
