"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Check, MapPin, CreditCard, Package, Repeat, RotateCcw, Truck, FileText,
} from "lucide-react";
import { Card, Badge, Button, Dialog, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { orderStatusLabel, titleCase, fmtDate, fmtDateTime, fmtNum } from "@/app/admin/_components/i18n";
import { ORDER_STEPPER_PATH } from "@/app/admin/_components/order-transitions";

interface RefundRow { id: string; amount: number; reason: string | null; providerRef: string | null; createdAt: string }
interface PaymentRow {
  id: string; provider: string; status: string; amount: number; currency: string;
  providerRef: string | null; failureReason: string | null; capturedAt: string | null;
  createdAt: string; refundedTotal: number; refundable: number; refunds: RefundRow[];
}
interface OrderDetail {
  orderNumber: string; status: string; source: string; placedAt: string; currency: string;
  subtotal: number; discountTotal: number; shippingTotal: number; taxTotal: number; grandTotal: number;
  couponCode: string | null;
  customer: { id: string; email: string; name: string; memberIdNumber: string | null };
  items: { id: string; nameEn: string; nameAr: string; quantity: number; unitPrice: number; lineTotal: number }[];
  boxSelections: { line: string; productEn: string; productAr: string; quantity: number }[];
  address: {
    recipient: string; phone: string; cityEn: string; cityAr: string; district: string | null;
    street: string; building: string | null; apartment: string | null; instructions: string | null;
  } | null;
  payments: PaymentRow[];
  invoice: {
    invoiceNumber: string; status: string; subtotal: number; taxTotal: number; grandTotal: number;
    vatNumber: string | null; issuedAt: string; paidAt: string | null;
  } | null;
  shipment: { status: string; trackingNumber: string | null; carrier: string | null; estimatedAt: string | null; deliveredAt: string | null } | null;
  subscription: {
    id: string; status: string; termMonths: number; endsAt: string | null;
    planEn: string | null; planAr: string | null; cats: { id: string; name: string }[];
  } | null;
}

const TERMINAL_BAD = ["CANCELLED", "RETURNED", "FAILED"];

export default function AdminOrderDetail() {
  const params = useParams<{ orderNumber: string }>();
  const orderNumber = params.orderNumber;
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [refundFor, setRefundFor] = React.useState<PaymentRow | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-order", orderNumber],
    queryFn: () => authedFetch<OrderDetail>(`/admin/orders/${orderNumber}`),
    enabled: !!user?.isStaff && !!orderNumber,
  });

  if (isLoading) {
    return <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-muted-foreground">{isAr ? "تعذّر تحميل الطلب." : "Couldn’t load this order."}</p>
        <Link href="/admin/orders"><Button variant="outline" size="sm" className="mt-4">{isAr ? "العودة للطلبات" : "Back to orders"}</Button></Link>
      </div>
    );
  }

  const sar = data.currency;
  const money = (n: number) => `${fmtNum(n, isAr)} ${sar}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/orders" aria-label={isAr ? "رجوع" : "Back"}>
            <Button variant="ghost" size="sm"><ArrowLeft className={isAr ? "size-4 rotate-180" : "size-4"} /></Button>
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight" dir="ltr">{data.orderNumber}</h1>
              <Badge variant={TERMINAL_BAD.includes(data.status) ? "destructive" : data.status === "DELIVERED" ? "success" : "secondary"}>
                {orderStatusLabel(data.status, isAr)}
              </Badge>
              <Badge variant="outline">{titleCase(data.source)}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              <Link href={`/admin/customers/${data.customer.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                {data.customer.name}
              </Link>
              <span dir="ltr"> · {data.customer.email}</span>
              {data.customer.memberIdNumber && <span dir="ltr"> · {data.customer.memberIdNumber}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{fmtDateTime(data.placedAt, isAr)}</p>
          </div>
        </div>
      </div>

      {/* Status stepper — the fulfilment path; a terminal bad status shows as a banner. */}
      {TERMINAL_BAD.includes(data.status) ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {isAr
            ? `هذا الطلب في حالة «${orderStatusLabel(data.status, isAr)}».`
            : `This order is ${orderStatusLabel(data.status, isAr).toLowerCase()}.`}
        </div>
      ) : (
        <StatusStepper status={data.status} isAr={isAr} />
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {/* Items */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display font-semibold"><Package className="size-4 text-muted-foreground" /> {isAr ? "العناصر" : "Items"}</h2>
            {data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {data.subscription
                  ? (isAr ? "طلب عضوية — محتويات الصندوق أدناه." : "Membership order — box contents below.")
                  : (isAr ? "لا عناصر." : "No items.")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {data.items.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{isAr ? i.nameAr : i.nameEn}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">{fmtNum(i.quantity, isAr)} × {money(i.unitPrice)}</p>
                    </div>
                    <span className="font-semibold tabular-nums">{money(i.lineTotal)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* The member's brand/flavor picks — what the box must actually ship. */}
            {data.boxSelections.length > 0 && (
              <div className="mt-4 rounded-xl bg-muted/40 p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {isAr ? "اختيارات الصندوق" : "Box picks"}
                </p>
                <div className="space-y-1.5">
                  {data.boxSelections.map((b, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-muted-foreground">{b.line}</span>
                      <span className="font-medium">{isAr ? b.productAr : b.productEn}{b.quantity > 1 ? ` × ${fmtNum(b.quantity, isAr)}` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Payment */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display font-semibold"><CreditCard className="size-4 text-muted-foreground" /> {isAr ? "الدفع" : "Payment"}</h2>

            {/* VAT breakdown */}
            <div className="mb-4 space-y-1.5 text-sm">
              <Row label={isAr ? "المجموع الفرعي" : "Subtotal"} value={money(data.subtotal)} />
              {data.discountTotal > 0 && <Row label={isAr ? `الخصم${data.couponCode ? ` (${data.couponCode})` : ""}` : `Discount${data.couponCode ? ` (${data.couponCode})` : ""}`} value={`− ${money(data.discountTotal)}`} />}
              {data.shippingTotal > 0 && <Row label={isAr ? "الشحن" : "Shipping"} value={money(data.shippingTotal)} />}
              <Row label={isAr ? "ضريبة القيمة المضافة" : "VAT"} value={money(data.taxTotal)} />
              <div className="border-t border-border pt-1.5">
                <Row label={isAr ? "الإجمالي" : "Grand total"} value={money(data.grandTotal)} bold />
              </div>
            </div>

            {data.payments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{isAr ? "لا مدفوعات مسجلة." : "No payments recorded."}</p>
            ) : (
              <div className="space-y-3">
                {data.payments.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{titleCase(p.provider)}</span>
                        <PaymentStatusBadge status={p.status} isAr={isAr} />
                      </div>
                      <span className="font-semibold tabular-nums">{money(p.amount)}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                      {p.providerRef ?? "—"}{p.capturedAt ? ` · ${fmtDateTime(p.capturedAt, isAr)}` : ""}
                    </p>
                    {p.failureReason && <p className="mt-1 text-xs text-destructive">{p.failureReason}</p>}

                    {/* Refund history */}
                    {p.refunds.length > 0 && (
                      <div className="mt-3 space-y-1.5 rounded-lg bg-muted/40 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{isAr ? "الاستردادات" : "Refunds"}</p>
                        {p.refunds.map((r) => (
                          <div key={r.id} className="flex items-start justify-between gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">{fmtDate(r.createdAt, isAr)}{r.reason ? ` — ${r.reason}` : ""}</p>
                            </div>
                            <span className="font-medium tabular-nums text-destructive">− {money(r.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {p.refundable > 0 && (
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {isAr ? `قابل للاسترداد: ${money(p.refundable)}` : `Refundable: ${money(p.refundable)}`}
                        </p>
                        <Button variant="outline" size="sm" onClick={() => setRefundFor(p)}>
                          <RotateCcw className="size-4" /> {isAr ? "استرداد" : "Refund"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Invoice */}
            {data.invoice && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted-foreground"><FileText className="size-4" /> <span dir="ltr">{data.invoice.invoiceNumber}</span></span>
                <span className="flex items-center gap-2">
                  <Badge variant={data.invoice.status === "PAID" ? "success" : data.invoice.status === "REFUNDED" ? "destructive" : "secondary"}>{titleCase(data.invoice.status)}</Badge>
                  <span className="text-xs text-muted-foreground">{isAr ? "شامل الضريبة" : "VAT-inclusive"} · {money(data.invoice.taxTotal)} {isAr ? "ضريبة" : "VAT"}</span>
                </span>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 lg:col-span-2">
          {/* Delivery */}
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 font-display font-semibold"><MapPin className="size-4 text-muted-foreground" /> {isAr ? "التوصيل" : "Delivery"}</h2>
            {data.address ? (
              <div className="space-y-1 text-sm">
                <p className="font-medium">{data.address.recipient}</p>
                <p className="text-muted-foreground" dir="ltr">{data.address.phone}</p>
                <p className="text-muted-foreground">
                  {[data.address.street, data.address.building, data.address.apartment, data.address.district].filter(Boolean).join(", ")}
                </p>
                <p className="text-muted-foreground">{isAr ? data.address.cityAr : data.address.cityEn}</p>
                {data.address.instructions && <p className="text-xs text-muted-foreground">“{data.address.instructions}”</p>}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{isAr ? "لا يوجد عنوان." : "No address on file."}</p>
            )}
            {data.shipment && (
              <div className="mt-4 space-y-1 rounded-xl bg-muted/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium"><Truck className="size-4 text-muted-foreground" /> {titleCase(data.shipment.status)}</p>
                {data.shipment.trackingNumber && <p className="text-xs text-muted-foreground" dir="ltr">{data.shipment.carrier ?? ""} {data.shipment.trackingNumber}</p>}
                {data.shipment.deliveredAt
                  ? <p className="text-xs text-muted-foreground">{isAr ? "تم التوصيل " : "Delivered "}{fmtDateTime(data.shipment.deliveredAt, isAr)}</p>
                  : data.shipment.estimatedAt && <p className="text-xs text-muted-foreground">{isAr ? "متوقع " : "ETA "}{fmtDate(data.shipment.estimatedAt, isAr)}</p>}
              </div>
            )}
          </Card>

          {/* Subscription */}
          {data.subscription && (
            <Card className="p-6">
              <h2 className="mb-4 flex items-center gap-2 font-display font-semibold"><Repeat className="size-4 text-muted-foreground" /> {isAr ? "الاشتراك" : "Subscription"}</h2>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{isAr ? data.subscription.planAr ?? data.subscription.planEn : data.subscription.planEn}</span>
                  <Badge variant={data.subscription.status === "ACTIVE" ? "success" : "secondary"}>{titleCase(data.subscription.status)}</Badge>
                </div>
                <p className="text-muted-foreground">
                  {isAr ? `مدة الالتزام: ${fmtNum(data.subscription.termMonths, isAr)} أشهر` : `Term: ${fmtNum(data.subscription.termMonths, isAr)} months`}
                  {data.subscription.endsAt && ` · ${isAr ? "تنتهي" : "ends"} ${fmtDate(data.subscription.endsAt, isAr)}`}
                </p>
                {data.subscription.cats.length > 0 && (
                  <p className="text-muted-foreground">{isAr ? "القطط: " : "Cats: "}{data.subscription.cats.map((c) => c.name).join("، ")}</p>
                )}
                <Link href={`/admin/customers/${data.customer.id}`} className="inline-block text-sm font-medium underline-offset-2 hover:underline">
                  {isAr ? "إدارة من ملف العميل ←" : "Manage from the customer file →"}
                </Link>
              </div>
            </Card>
          )}
        </div>
      </div>

      {refundFor && (
        <RefundDialog
          payment={refundFor}
          orderNumber={data.orderNumber}
          currency={data.currency}
          isAr={isAr}
          onClose={() => setRefundFor(null)}
        />
      )}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function Row({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular-nums", bold && "font-semibold")}>{value}</span>
    </div>
  );
}

function StatusStepper({ status, isAr }: { status: string; isAr: boolean }) {
  const current = ORDER_STEPPER_PATH.indexOf(status as (typeof ORDER_STEPPER_PATH)[number]);
  return (
    <Card className="overflow-x-auto p-4">
      <ol className="flex min-w-max items-center gap-0">
        {ORDER_STEPPER_PATH.map((step, i) => {
          const done = current >= 0 && i < current;
          const active = i === current;
          return (
            <li key={step} className="flex items-center">
              {i > 0 && <span className={cn("mx-1 h-px w-6 sm:w-10", done || active ? "bg-primary" : "bg-border")} />}
              <span className="flex flex-col items-center gap-1 px-1">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border text-[10px] font-semibold",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary/10 text-primary",
                    !done && !active && "border-border text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className={cn("text-[10px]", active ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {orderStatusLabel(step, isAr)}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function PaymentStatusBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const AR: Record<string, string> = {
    PENDING: "معلّق", AUTHORIZED: "مفوَّض", CAPTURED: "مُحصَّل", FAILED: "فشل",
    REFUNDED: "مُسترد", PARTIALLY_REFUNDED: "مُسترد جزئياً", CANCELLED: "ملغى",
  };
  const variant =
    status === "CAPTURED" ? "success"
    : status === "FAILED" || status === "CANCELLED" ? "destructive"
    : status === "REFUNDED" || status === "PARTIALLY_REFUNDED" ? "warning"
    : "secondary";
  return <Badge variant={variant}>{isAr ? AR[status] ?? status : titleCase(status)}</Badge>;
}

/**
 * Refund modal (R030 — refunds must feel safe): full/partial toggle, amount
 * hard-capped at what's still refundable, a REQUIRED reason (it lands in the
 * refund record + audit log), and a plain statement of what happens next.
 * Executes against the existing PSP-first admin refund endpoint.
 */
function RefundDialog({ payment, orderNumber, currency, isAr, onClose }: {
  payment: PaymentRow; orderNumber: string; currency: string; isAr: boolean; onClose: () => void;
}) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [mode, setMode] = React.useState<"full" | "partial">("full");
  const [amount, setAmount] = React.useState(String(payment.refundable));
  const [reason, setReason] = React.useState("");

  const refund = useMutation({
    mutationFn: () =>
      authedFetch<{ refunded: number; fullyRefunded: boolean }>(`/admin/orders/${orderNumber}/refund`, {
        method: "POST",
        body: JSON.stringify({
          ...(mode === "partial" ? { amount: Number(amount) } : {}),
          reason: reason.trim(),
        }),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-order", orderNumber] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
      onClose();
      toast({
        title: isAr ? "تم تنفيذ الاسترداد" : "Refund executed",
        description: isAr
          ? `${r.refunded.toLocaleString("ar-SA")} ${currency}${r.fullyRefunded ? " — استرداد كامل" : ""}`
          : `${r.refunded.toLocaleString("en-US")} ${currency}${r.fullyRefunded ? " — fully refunded" : ""}`,
        variant: "success",
      });
    },
    onError: (e: Error) => toast({ title: isAr ? "فشل الاسترداد" : "Refund failed", description: e.message, variant: "error" }),
  });

  const amountNum = mode === "full" ? payment.refundable : Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= payment.refundable;
  const canSubmit = amountValid && reason.trim().length > 0 && !refund.isPending;
  const money = (n: number) => `${fmtNum(n, isAr)} ${currency}`;

  return (
    <Dialog
      open
      onClose={refund.isPending ? () => {} : onClose}
      title={isAr ? "استرداد مبلغ" : "Refund payment"}
      description={
        isAr
          ? `المتاح للاسترداد من هذه الدفعة: ${money(payment.refundable)}.`
          : `Refundable on this payment: ${money(payment.refundable)}.`
      }
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={refund.isPending}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button variant="destructive" size="sm" onClick={() => refund.mutate()} disabled={!canSubmit} loading={refund.isPending}>
            {isAr ? `استرداد ${amountValid ? money(round2(amountNum)) : ""}` : `Refund ${amountValid ? money(round2(amountNum)) : ""}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Full / partial toggle */}
        <div className="flex gap-1 rounded-xl border border-border p-1">
          {(["full", "partial"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); if (m === "full") setAmount(String(payment.refundable)); }}
              disabled={refund.isPending}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m === "full" ? (isAr ? "استرداد كامل" : "Full refund") : (isAr ? "استرداد جزئي" : "Partial refund")}
            </button>
          ))}
        </div>

        {mode === "partial" && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{isAr ? `المبلغ (${currency})` : `Amount (${currency})`}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0.01}
              max={payment.refundable}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={refund.isPending}
              dir="ltr"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {!amountValid && amount !== "" && (
              <span className="mt-1 block text-xs text-destructive">
                {isAr ? `أدخل مبلغاً بين 0.01 و ${money(payment.refundable)}.` : `Enter an amount between 0.01 and ${money(payment.refundable)}.`}
              </span>
            )}
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium">{isAr ? "السبب (إلزامي)" : "Reason (required)"}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            disabled={refund.isPending}
            placeholder={isAr ? "لماذا يُسترد هذا المبلغ؟" : "Why is this being refunded?"}
            className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>

        <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {isAr
            ? "يُنفَّذ الاسترداد لدى مزود الدفع أولاً، ويُسجَّل في سجل التدقيق، وسيصل العميل إشعار به."
            : "The refund executes at the payment provider first, is recorded in the audit log, and the member will be notified."}
        </p>
      </div>
    </Dialog>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;
