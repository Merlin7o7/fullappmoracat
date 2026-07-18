"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Wallet, Sparkles, Cat as CatIcon, Ban, RotateCcw, EyeOff,
  Pause, Play, XCircle, MapPin, LifeBuoy, CreditCard,
} from "lucide-react";
import { Card, Badge, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { statusMeta, orderStatusLabel, titleCase, fmtDate, fmtNum } from "@/app/admin/_components/i18n";
import { TicketStatusBadge } from "@/components/ticket-status-badge";

interface SubscriptionRow {
  id: string; status: string; price: number; plan: string | null; planAr: string | null;
  termMonths: number; endsAt: string | null; cancelAtTermEnd: boolean;
  pausedAt: string | null; nextDeliveryAt: string | null; cats: string[];
}
interface CustomerDetail {
  id: string; memberIdNumber: string | null; email: string; name: string; phone: string | null;
  status: string; createdAt: string; walletBalance: number; loyaltyPoints: number;
  cats: { id: string; name: string; weightKg: number | null; isPublic: boolean; hiddenAt: string | null; catIdNumber: string | null; membershipStatus: string }[];
  subscriptions: SubscriptionRow[];
  orders: { orderNumber: string; status: string; grandTotal: number; placedAt: string }[];
  addresses: { id: string; label: string | null; recipient: string; phone: string; cityEn: string; cityAr: string; district: string | null; street: string; building: string | null; apartment: string | null; isDefault: boolean }[];
  tickets: { ticketNumber: string; subject: string; status: string; priority: string; updatedAt: string }[];
  payments: { id: string; orderNumber: string; provider: string; status: string; amount: number; currency: string; refundedTotal: number; createdAt: string }[];
}

type SubAction = "pause" | "resume" | "cancel";

export default function AdminCustomerDetail() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [subConfirm, setSubConfirm] = React.useState<{ sub: SubscriptionRow; action: SubAction } | null>(null);

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

  const subAction = useMutation({
    mutationFn: ({ subId, action, reason }: { subId: string; action: SubAction; reason?: string }) =>
      authedFetch(`/admin/subscriptions/${subId}/${action}`, {
        method: "POST",
        body: JSON.stringify({ ...(reason ? { reason } : {}) }),
      }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["admin-customer", id] });
      setSubConfirm(null);
      toast({
        title:
          v.action === "pause" ? (isAr ? "تم إيقاف الاشتراك مؤقتاً" : "Membership paused")
          : v.action === "resume" ? (isAr ? "تم استئناف الاشتراك" : "Membership resumed")
          : (isAr ? "تم إلغاء الاشتراك" : "Membership cancelled"),
        variant: "success",
      });
    },
    onError: (e: Error) => {
      setSubConfirm(null);
      toast({ title: isAr ? "فشل الإجراء" : "Action failed", description: e.message, variant: "error" });
    },
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

  const subConfirmCopy = subConfirm ? subActionCopy(subConfirm, isAr) : null;

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
              {/* The membership identity line: Member ID + covered cats (the Cat ID is the soul of the product). */}
              {data.memberIdNumber && <span className="font-mono" dir="ltr">{data.memberIdNumber}</span>}
              {data.memberIdNumber && " · "}
              {isAr ? "عضو منذ " : "Member since "}{fmtDate(data.createdAt, isAr)}
              {data.cats.length > 0 && ` · ${data.cats.map((c) => c.name).join("، ")}`}
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
                  <p className="text-xs text-muted-foreground" dir="ltr">
                    {cat.catIdNumber ?? (isAr ? "بدون بطاقة" : "No Cat ID")}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant={cat.membershipStatus === "ACTIVE" ? "success" : "secondary"}>
                    {cat.membershipStatus === "ACTIVE" ? (isAr ? "عضوية نشطة" : "Member") : (isAr ? "بلا عضوية" : "No membership")}
                  </Badge>
                  {cat.hiddenAt ? (
                    <Badge variant="destructive"><EyeOff className="size-3" /> {isAr ? "مخفي" : "Hidden"}</Badge>
                  ) : cat.isPublic ? (
                    <Badge variant="outline">{isAr ? "عام" : "Public"}</Badge>
                  ) : (
                    <Badge variant="secondary">{isAr ? "خاص" : "Private"}</Badge>
                  )}
                </div>
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
          <div className="space-y-3">
            {data.subscriptions.map((sub) => {
              const canPause = sub.status === "ACTIVE";
              const canResume = sub.status === "PAUSED";
              const canCancel = (sub.status === "ACTIVE" || sub.status === "PAUSED") && !sub.cancelAtTermEnd;
              return (
                <Card key={sub.id} className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{isAr ? sub.planAr ?? sub.plan ?? "—" : sub.plan ?? "—"}</span>
                      <Badge variant={sub.status === "ACTIVE" ? "success" : sub.status === "PAUSED" ? "warning" : "secondary"}>{titleCase(sub.status)}</Badge>
                      {sub.cancelAtTermEnd && (
                        <Badge variant="warning">{isAr ? "لن يتجدد" : "Won’t renew"}</Badge>
                      )}
                    </div>
                    <span className="font-semibold tabular-nums">{fmtNum(sub.price, isAr)} {isAr ? "ر.س/شهر" : "SAR/mo"}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {isAr ? `التزام ${fmtNum(sub.termMonths, isAr)} أشهر` : `${fmtNum(sub.termMonths, isAr)}-month term`}
                    {sub.endsAt && ` · ${isAr ? "ينتهي" : "ends"} ${fmtDate(sub.endsAt, isAr)}`}
                    {sub.nextDeliveryAt && ` · ${isAr ? "التوصيل القادم" : "next delivery"} ${fmtDate(sub.nextDeliveryAt, isAr)}`}
                    {sub.pausedAt && ` · ${isAr ? "موقوف منذ" : "paused since"} ${fmtDate(sub.pausedAt, isAr)}`}
                    {sub.cats.length > 0 && ` · ${sub.cats.join("، ")}`}
                  </p>
                  {(canPause || canResume || canCancel) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canPause && (
                        <Button variant="outline" size="sm" onClick={() => setSubConfirm({ sub, action: "pause" })}>
                          <Pause className="size-4" /> {isAr ? "إيقاف مؤقت" : "Pause"}
                        </Button>
                      )}
                      {canResume && (
                        <Button variant="outline" size="sm" onClick={() => setSubConfirm({ sub, action: "resume" })}>
                          <Play className="size-4" /> {isAr ? "استئناف" : "Resume"}
                        </Button>
                      )}
                      {canCancel && (
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setSubConfirm({ sub, action: "cancel" })}>
                          <XCircle className="size-4" /> {isAr ? "إلغاء" : "Cancel"}
                        </Button>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
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
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      <Link href={`/admin/orders/${o.orderNumber}`} className="underline-offset-2 hover:underline">{o.orderNumber}</Link>
                    </td>
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

      {/* Recent payments */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><CreditCard className="size-4 text-muted-foreground" /> {isAr ? "المدفوعات الأخيرة" : "Recent payments"}</h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا مدفوعات." : "No payments."}</p>
        ) : (
          <Card className="overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40 text-start text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الطلب" : "Order"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "المزود" : "Provider"}</th>
                  <th className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                  <th className="px-4 py-3 text-end font-medium">{isAr ? "المبلغ" : "Amount"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium" dir="ltr">
                      <Link href={`/admin/orders/${p.orderNumber}`} className="underline-offset-2 hover:underline">{p.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{titleCase(p.provider)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.status === "CAPTURED" ? "success" : p.status === "FAILED" ? "destructive" : p.status.includes("REFUND") ? "warning" : "secondary"}>
                        {titleCase(p.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-end font-semibold tabular-nums">
                      {fmtNum(p.amount, isAr)} {p.currency}
                      {p.refundedTotal > 0 && (
                        <span className="block text-xs font-normal text-destructive">− {fmtNum(p.refundedTotal, isAr)} {isAr ? "مسترد" : "refunded"}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      {/* Support tickets */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><LifeBuoy className="size-4 text-muted-foreground" /> {isAr ? "تذاكر الدعم" : "Support tickets"}</h2>
        {data.tickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا تذاكر." : "No tickets."}</p>
        ) : (
          <Card className="divide-y divide-border p-0">
            {data.tickets.map((t) => (
              <Link key={t.ticketNumber} href="/admin/support" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground" dir="ltr">{t.ticketNumber} · {fmtDate(t.updatedAt, isAr)}</p>
                </div>
                <TicketStatusBadge status={t.status} isAr={isAr} />
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* Addresses (read-only) */}
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><MapPin className="size-4 text-muted-foreground" /> {isAr ? "العناوين" : "Addresses"}</h2>
        {data.addresses.length === 0 ? (
          <p className="text-sm text-muted-foreground">{isAr ? "لا عناوين." : "No addresses."}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.addresses.map((a) => (
              <Card key={a.id} className="p-4 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-medium">{a.label || a.recipient}</p>
                  {a.isDefault && <Badge variant="outline">{isAr ? "افتراضي" : "Default"}</Badge>}
                </div>
                <p className="text-muted-foreground">{a.recipient} · <span dir="ltr">{a.phone}</span></p>
                <p className="text-muted-foreground">
                  {[a.street, a.building, a.apartment, a.district].filter(Boolean).join(", ")} — {isAr ? a.cityAr : a.cityEn}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Suspend / reactivate the member */}
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

      {/* Subscription action confirm — always with a reason (audited). */}
      {subConfirm && subConfirmCopy && (
        <ConfirmDialog
          open
          onClose={() => setSubConfirm(null)}
          onConfirm={(reason) => subAction.mutate({ subId: subConfirm.sub.id, action: subConfirm.action, reason })}
          pending={subAction.isPending}
          isAr={isAr}
          destructive={subConfirm.action === "cancel"}
          withReason
          title={subConfirmCopy.title}
          description={subConfirmCopy.description}
          confirmLabel={subConfirmCopy.confirm}
          reasonLabel={isAr ? "السبب (يُسجَّل في سجل التدقيق)" : "Reason (recorded in the audit log)"}
        />
      )}
    </div>
  );
}

/** Honest copy per action — mirrors the R062/R063 semantics the API enforces. */
function subActionCopy({ sub, action }: { sub: SubscriptionRow; action: SubAction }, isAr: boolean) {
  const hasTerm = sub.endsAt != null && new Date(sub.endsAt).getTime() > Date.now();
  if (action === "pause") {
    return {
      title: isAr ? "إيقاف الاشتراك مؤقتاً؟" : "Pause this membership?",
      description: isAr
        ? "تتوقف التوصيلات فقط — تبقى عضوية القطط نشطة لأن المدة مدفوعة، وعند الاستئناف تُعاد أيام الإيقاف كاملة."
        : "Only deliveries stop — the cats keep their paid membership, and every paused day is given back on resume.",
      confirm: isAr ? "إيقاف مؤقت" : "Pause",
    };
  }
  if (action === "resume") {
    return {
      title: isAr ? "استئناف الاشتراك؟" : "Resume this membership?",
      description: isAr
        ? "تمتد نهاية المدة والتوصيل القادم بقدر أيام الإيقاف — لا يخسر العضو أي شهر مدفوع."
        : "The term end and next delivery slide forward by the paused duration — no prepaid month is lost.",
      confirm: isAr ? "استئناف" : "Resume",
    };
  }
  return {
    title: isAr ? "إلغاء الاشتراك؟" : "Cancel this membership?",
    description: hasTerm
      ? (isAr
          ? "المدة مدفوعة مسبقاً، لذا يعني الإلغاء «عدم التجديد»: تستمر الخدمة والصناديق حتى نهاية المدة ثم تنتهي العضوية — لا يُصادر أي شهر مدفوع."
          : "The term is prepaid, so cancelling means “won’t renew”: boxes and membership keep servicing until the term ends, then lapse — no paid month is confiscated.")
      : (isAr
          ? "لا توجد مدة متبقية، لذا يُلغى الاشتراك فوراً وتنتهي عضوية القطط."
          : "No term remains, so the membership cancels immediately and the cats’ membership lapses."),
    confirm: isAr ? "إلغاء الاشتراك" : "Cancel membership",
  };
}
