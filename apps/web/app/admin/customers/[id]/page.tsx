"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Wallet, Sparkles, Cat as CatIcon, Ban, RotateCcw, EyeOff } from "lucide-react";
import { Card, Badge, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { statusMeta, orderStatusLabel, fmtDate, fmtNum } from "@/app/admin/_components/i18n";

interface CustomerDetail {
  id: string; email: string; name: string; phone: string | null;
  status: string; createdAt: string; walletBalance: number; loyaltyPoints: number;
  cats: { id: string; name: string; weightKg: number | null; isPublic: boolean; hiddenAt: string | null }[];
  subscriptions: { id: string; status: string; price: number; plan: string }[];
  orders: { orderNumber: string; status: string; grandTotal: number; placedAt: string }[];
}

export default function AdminCustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-customer", id],
    queryFn: () => authedFetch<CustomerDetail>(`/admin/customers/${id}`),
    enabled: !!user?.isStaff && !!id,
  });

  const status = useMutation({
    mutationFn: ({ action, reason }: { action: "suspend" | "reactivate"; reason?: string }) =>
      authedFetch<{ id: string; status: string }>(`/admin/customers/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
      }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
      qc.invalidateQueries({ queryKey: ["admin-customers"] });
      setConfirmOpen(false);
      toast({
        title: r.status === "SUSPENDED" ? (isAr ? "تم إيقاف العضو" : "Member suspended") : (isAr ? "تمت إعادة التفعيل" : "Member reactivated"),
        variant: "success",
      });
    },
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  if (isLoading) {
    return <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl py-16 text-center">
        <p className="text-sm text-muted-foreground">{isAr ? "تعذّر تحميل العميل." : "Couldn’t load this customer."}</p>
        <Link href="/admin/customers"><Button variant="outline" size="sm" className="mt-4">{isAr ? "العودة للعملاء" : "Back to customers"}</Button></Link>
      </div>
    );
  }

  const s = statusMeta(data.status);
  const isActive = data.status === "ACTIVE";
  const isSuspended = data.status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/admin/customers" aria-label={isAr ? "رجوع" : "Back"}>
            <Button variant="ghost" size="sm"><ArrowLeft className={isAr ? "size-4 rotate-180" : "size-4"} /></Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{data.name}</h1>
              <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge>
            </div>
            <p className="text-sm text-muted-foreground" dir="ltr">{data.email}{data.phone ? ` · ${data.phone}` : ""}</p>
            <p className="text-xs text-muted-foreground">
              {isAr ? "عضو منذ " : "Member since "}{fmtDate(data.createdAt, isAr)}
            </p>
          </div>
        </div>
        {(isActive || isSuspended) && (
          <Button
            variant={isActive ? "destructive" : "primary"}
            size="sm"
            onClick={() => setConfirmOpen(true)}
          >
            {isActive ? <><Ban className="size-4" /> {isAr ? "إيقاف" : "Suspend"}</> : <><RotateCcw className="size-4" /> {isAr ? "إعادة تفعيل" : "Reactivate"}</>}
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Wallet className="size-5" /></span>
          <div>
            <p className="text-xs text-muted-foreground">{isAr ? "رصيد المحفظة" : "Wallet balance"}</p>
            <p className="font-display text-lg font-semibold tabular-nums">{fmtNum(data.walletBalance, isAr)} {isAr ? "ر.س" : "SAR"}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground"><Sparkles className="size-5" /></span>
          <div>
            <p className="text-xs text-muted-foreground">{isAr ? "نقاط الولاء" : "Loyalty points"}</p>
            <p className="font-display text-lg font-semibold tabular-nums">{fmtNum(data.loyaltyPoints, isAr)}</p>
          </div>
        </Card>
      </div>

      {/* Cats */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{isAr ? "القطط" : "Cats"}</h2>
        {data.cats.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد قطط." : "No cats."}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.cats.map((cat) => (
              <Card key={cat.id} className="flex items-center gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted"><CatIcon className="size-5 text-muted-foreground" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">{cat.weightKg != null ? `${fmtNum(cat.weightKg, isAr)} ${isAr ? "كجم" : "kg"}` : "—"}</p>
                </div>
                {cat.hiddenAt ? (
                  <Badge variant="destructive"><EyeOff className="size-3" /> {isAr ? "مخفي" : "Hidden"}</Badge>
                ) : cat.isPublic ? (
                  <Badge variant="outline">{isAr ? "عام" : "Public"}</Badge>
                ) : (
                  <Badge variant="secondary">{isAr ? "خاص" : "Private"}</Badge>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Subscriptions */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{isAr ? "الاشتراكات" : "Subscriptions"}</h2>
        {data.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد اشتراكات." : "No subscriptions."}</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الخطة" : "Plan"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end font-medium">{isAr ? "السعر" : "Price"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.subscriptions.map((sub) => (
                  <tr key={sub.id}>
                    <td className="px-4 py-3 font-medium">{sub.plan}</td>
                    <td className="px-4 py-3"><Badge variant={sub.status === "ACTIVE" ? "success" : "secondary"}>{sub.status}</Badge></td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">{fmtNum(sub.price, isAr)} {isAr ? "ر.س" : "SAR"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Orders */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">{isAr ? "الطلبات" : "Orders"}</h2>
        {data.orders.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد طلبات." : "No orders."}</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الطلب" : "Order"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "التاريخ" : "Date"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end font-medium">{isAr ? "الإجمالي" : "Total"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.orders.map((o) => (
                  <tr key={o.orderNumber}>
                    <td className="px-4 py-3 font-medium" dir="ltr">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(o.placedAt, isAr, { day: "numeric", month: "short" })}</td>
                    <td className="px-4 py-3 text-muted-foreground">{orderStatusLabel(o.status, isAr)}</td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">{fmtNum(o.grandTotal, isAr)} {isAr ? "ر.س" : "SAR"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={(reason) => status.mutate({ action: isActive ? "suspend" : "reactivate", reason })}
        pending={status.isPending}
        isAr={isAr}
        destructive={isActive}
        withReason={isActive}
        title={isActive ? (isAr ? "إيقاف هذا العضو؟" : "Suspend this member?") : (isAr ? "إعادة تفعيل هذا العضو؟" : "Reactivate this member?")}
        description={
          isActive
            ? (isAr
                ? "سيؤدي الإيقاف إلى تسجيل خروج العضو فوراً وإخفاء ملفات قططه العامة من المجتمع."
                : "Suspending logs the member out immediately and hides their public cats from the community.")
            : (isAr
                ? "ستتم استعادة وصول العضو وإظهار قططه العامة مجدداً."
                : "This restores the member’s access and makes their public cats visible again.")
        }
        confirmLabel={isActive ? (isAr ? "إيقاف" : "Suspend") : (isAr ? "إعادة تفعيل" : "Reactivate")}
        reasonLabel={isAr ? "سبب الإيقاف (اختياري)" : "Reason for suspension (optional)"}
      />
    </div>
  );
}
