"use client";

// ════════════════════════════════════════════════════════════════════════
//  Subscriptions — the manage surface for the honest term model.
//
//  The member paid price × termMonths upfront; nothing ever auto-renews.
//  Every card therefore answers the three money questions truthfully (R021
//  post-purchase): paid through WHEN, how many boxes REMAIN, what was the
//  TOTAL. Each lifecycle state gets its own honest treatment:
//    DRAFT      → awaiting payment; one tap resumes the SAME session.
//    won't-renew→ amber, benefits continue to endsAt (never confiscated).
//    PAUSED     → the paused days are saved; resume gives them back.
//    EXPIRED    → warm, records safe, renewing is coming home (R064).
//  Cancelling is dignified and honest (R063), pause is offered first (R062),
//  and a remainder refund is safe to raise (R030).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Pause,
  Play,
  X,
  Repeat,
  Truck,
  CreditCard,
  CalendarClock,
  Package,
  RefreshCcw,
  Undo2,
} from "lucide-react";
import { Card, Badge, Button, Skeleton, Dialog, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { formatDate, monthsLabel } from "@/lib/datetime";
import { formatSAR, formatAmount, formatMoneyDate } from "@/lib/money";
import { friendlyError } from "@/lib/errors";
import { QueryError } from "@/components/query-error";
import { MembershipsClosedNotice } from "@/components/membership";
import { commerceEnabled } from "@/lib/features";
import { IlloCan, IlloPaw } from "@/components/illustrations";

type SubStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "CANCELLED" | "PAST_DUE" | "EXPIRED";

interface Sub {
  id: string;
  status: SubStatus | string;
  price: number; // monthly rate
  termMonths: number;
  termTotal: number;
  endsAt: string | null;
  boxesRemaining: number;
  monthsElapsed: number;
  nextDeliveryAt: string | null;
  pausedAt: string | null;
  pausedUntil: string | null;
  cancelAtTermEnd: boolean;
  refundRequested: boolean;
  resumeUrl: string | null;
  plan: { tier: string; nameEn: string; nameAr: string } | null;
  cats: { id: string; name: string }[];
  items: { nameEn: string; quantity: number }[];
}

type Verb = "pause" | "resume" | "cancel";

export default function SubscriptionsPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  // Hidden from nav in Community Mode but still URL-reachable. No one has a
  // subscription yet, so every price, "paid upfront" claim and "Complete
  // payment" button below must stay unrendered (R040) — and the page must read
  // as a welcome, not a failure (R111).
  const commerce = commerceEnabled();

  // The cancel conversation happens in a dialog that tells the truth about the
  // paid term and offers pause + refund paths before the quiet "won't renew".
  const [cancelFor, setCancelFor] = React.useState<Sub | null>(null);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [refundReason, setRefundReason] = React.useState("");
  // DRAFTs whose stored payment session has expired — they get a fresh
  // checkout link instead of a dead resume button (R112: every error recovers).
  const [expiredDrafts, setExpiredDrafts] = React.useState<Record<string, boolean>>({});
  // Pressed state while the browser navigates to a stored checkout URL.
  const [redirectingId, setRedirectingId] = React.useState<string | null>(null);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: () => authedFetch<Sub[]>("/subscriptions"),
    enabled: !!user && commerce,
  });

  const closeCancelDialog = () => {
    setCancelFor(null);
    setRefundOpen(false);
    setRefundReason("");
  };

  const doneCopy: Record<Verb, { en: string; ar: string }> = {
    pause: { en: "Membership paused — your days are saved", ar: "تم الإيقاف المؤقت — أيامك محفوظة" },
    resume: { en: "Welcome back — membership resumed", ar: "أهلاً بعودتك — استؤنفت العضوية" },
    cancel: { en: "It won't renew — everything you paid for still arrives", ar: "لن تتجدد — وكل ما دفعته يصلك كاملاً" },
  };

  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: Verb }) =>
      authedFetch(`/subscriptions/${id}/${verb}`, { method: "POST", body: "{}" }),
    onSuccess: (_d, { verb }) => {
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["cats"] });
      const l = doneCopy[verb];
      toast({ title: isAr ? l.ar : l.en, variant: verb === "cancel" ? "default" : "success" });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });
  const actionPending = (id: string, verb: Verb) =>
    action.isPending && action.variables?.id === id && action.variables?.verb === verb;

  const resumePayment = useMutation({
    mutationFn: (id: string) =>
      authedFetch<{ redirectUrl: string; orderNumber: string }>(
        `/subscriptions/${id}/resume-payment`,
        { method: "POST", body: "{}" }
      ),
    onSuccess: (res) => {
      if (res.redirectUrl) window.location.assign(res.redirectUrl);
    },
    onError: (e, id) => {
      const fe = friendlyError(e, isAr);
      if (fe.code === "DRAFT_EXPIRED") {
        // The old session is gone — offer a fresh checkout, don't dead-end.
        setExpiredDrafts((prev) => ({ ...prev, [id]: true }));
      }
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });

  const requestRefund = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      authedFetch<{ ok: boolean; status: string }>(`/subscriptions/${id}/refund-request`, {
        method: "POST",
        body: JSON.stringify(reason?.trim() ? { reason: reason.trim() } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      closeCancelDialog();
      toast({
        title: isAr ? "استلمنا طلب الاسترداد" : "Refund request received",
        description: isAr
          ? "فريق العناية يتابعه وسيتواصل معك قريباً."
          : "The care team is on it and will reach out soon.",
        variant: "success",
      });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      // Already requested = already in good hands — close and say so calmly.
      if (fe.code === "REFUND_ALREADY_REQUESTED") closeCancelDialog();
      toast({ title: fe.title, description: fe.message, variant: fe.code === "REFUND_ALREADY_REQUESTED" ? "default" : "error" });
    },
  });

  const completePayment = (sub: Sub) => {
    if (sub.resumeUrl) {
      setRedirectingId(sub.id);
      window.location.assign(sub.resumeUrl);
      return;
    }
    resumePayment.mutate(sub.id);
  };

  const freshCheckoutHref = (sub: Sub) =>
    `/portal/checkout?plan=${sub.plan?.tier ?? ""}${sub.cats[0] ? `&cat=${sub.cats[0].id}` : ""}`;

  const fmtShort = (d: string | null) =>
    d ? formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "short" }) : "—";

  // Every hook has run — safe to swap the commercial body for the honest one.
  if (!commerce) {
    return (
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {isAr ? "الاشتراكات" : "Subscriptions"}
          </h1>
        </div>
        <MembershipsClosedNotice
          isAr={isAr}
          body={
            isAr
              ? "ما فتحنا العضويات بعد، فما فيه اشتراك تديره الآن. هوية قطك وسجلّه معك، وأول ما نفتح نخبرك."
              : "Memberships aren't open yet, so there's nothing to manage here. Your cat's ID and records are yours already, and we'll tell you the moment we open."
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? "الاشتراكات" : "Subscriptions"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "مدفوعة مقدماً وبدون تجديد تلقائي — أوقف مؤقتاً أو ألغِ أو اطلب استرداداً في أي وقت"
            : "Paid upfront, never auto-renewed — pause, cancel, or request a refund anytime"}
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : data && data.length > 0 ? (
        data.map((sub) => {
          const status = sub.status as SubStatus;
          const wontRenew = status === "ACTIVE" && sub.cancelAtTermEnd;
          const draftExpired = !!expiredDrafts[sub.id];
          const catNames = sub.cats.map((c) => c.name).join(isAr ? "، " : ", ");
          const completing =
            redirectingId === sub.id ||
            (resumePayment.isPending && resumePayment.variables === sub.id);

          return (
            <Card key={sub.id} className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Repeat className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-display font-semibold">
                      {sub.plan ? (isAr ? sub.plan.nameAr : sub.plan.nameEn) : isAr ? "صندوق مخصص" : "Custom box"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {catNames || (isAr ? "بدون قطط" : "No cats")}
                    </p>
                  </div>
                </div>
                <SubStatusBadge status={status} wontRenew={wontRenew} isAr={isAr} />
              </div>

              {/* The money truth, on one line (R021): paid through · boxes left · total. */}
              {status !== "DRAFT" && sub.termMonths > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-muted/50 p-4 text-sm">
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  {sub.endsAt ? (
                    <span>
                      {isAr ? "مدفوعة حتى " : "Paid through "}
                      <strong className="font-semibold">{formatMoneyDate(sub.endsAt, isAr)}</strong>
                    </span>
                  ) : (
                    <span>{isAr ? `مدة ${monthsLabel(sub.termMonths, "ar")}` : `${monthsLabel(sub.termMonths, "en")} term`}</span>
                  )}
                  <span aria-hidden className="text-muted-foreground">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <Package className="size-4 text-muted-foreground" aria-hidden />
                    {isAr
                      ? `متبقي ${formatAmount(sub.boxesRemaining, true)} من ${formatAmount(sub.termMonths, true)} صناديق`
                      : `${formatAmount(sub.boxesRemaining, false)} of ${formatAmount(sub.termMonths, false)} boxes remaining`}
                  </span>
                  <span aria-hidden className="text-muted-foreground">·</span>
                  <span dir="ltr" className="tabular">
                    {formatSAR(sub.termTotal, isAr)}
                  </span>
                  <span className="text-muted-foreground">{isAr ? "إجمالاً" : "total"}</span>
                </div>
              )}

              {/* DRAFT: nothing has been charged — say so, then one clear action. */}
              {status === "DRAFT" && (
                <div className="mb-4 rounded-xl bg-muted/50 p-4 text-sm">
                  <p>
                    {isAr ? (
                      <>
                        <span dir="ltr" className="tabular font-semibold">{formatSAR(sub.termTotal, true)}</span>
                        {` لمدة ${monthsLabel(sub.termMonths, "ar")} — ما انخصم منك شيء بعد.`}
                      </>
                    ) : (
                      <>
                        <span dir="ltr" className="tabular font-semibold">{formatSAR(sub.termTotal, false)}</span>
                        {` for ${monthsLabel(sub.termMonths, "en")} — nothing has been charged yet.`}
                      </>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {isAr
                      ? "أكمل الدفع وتصير العضوية مفعّلة فوراً."
                      : "Complete the payment and the membership goes live right away."}
                  </p>
                </div>
              )}

              {/* Won't renew — amber, honest, and the member keeps every day they paid for. */}
              {wontRenew && sub.endsAt && (
                <p className="mb-4 rounded-xl bg-warning/10 p-4 text-sm text-[hsl(38_92%_26%)] dark:text-warning">
                  {isAr
                    ? `لن تتجدد — مزاياكم مستمرة حتى ${formatMoneyDate(sub.endsAt, true)}، وكل ما دفعتم يصلكم كاملاً.`
                    : `Won't renew — your benefits continue until ${formatMoneyDate(sub.endsAt, false)}, and everything you paid for still arrives.`}
                </p>
              )}

              {/* Paused — the days are saved, not lost (R062). */}
              {status === "PAUSED" && (
                <p className="mb-4 rounded-xl bg-muted/50 p-4 text-sm">
                  {isAr
                    ? "موقوف مؤقتاً — أيامك محفوظة، وتُضاف كاملة لمدتك عند الاستئناف."
                    : "Paused — your days are saved, and every one of them is added back when you resume."}
                </p>
              )}

              {/* Ended — warm, records safe, the door stays open (R064/R111). */}
              {status === "EXPIRED" && (
                <p className="mb-4 rounded-xl bg-muted/50 p-4 text-sm">
                  {isAr
                    ? "انتهت المدة — سجلّ قطك وهويته محفوظان دائماً. الرجوع يأخذ دقيقة."
                    : "The term has ended — your cat's records and ID are safe. Coming back takes a minute."}
                </p>
              )}

              {status === "PAST_DUE" && (
                <p className="mb-4 rounded-xl bg-warning/10 p-4 text-sm text-[hsl(38_92%_26%)] dark:text-warning">
                  {isAr
                    ? "في مشكلة بالدفعة الأخيرة — تواصل مع العناية ونحلّها معك."
                    : "There's an issue with the last payment — contact Care and we'll sort it out together."}
                </p>
              )}

              {/* Refund in progress — a promise being kept, shown plainly (R030). */}
              {sub.refundRequested && (
                <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Undo2 className="size-4 shrink-0" aria-hidden />
                  {isAr ? "طلب الاسترداد قيد المتابعة" : "Refund request in progress"}
                </p>
              )}

              {(status === "ACTIVE" || status === "PAUSED") && sub.nextDeliveryAt && (
                <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="size-4 shrink-0" aria-hidden />
                  {isAr ? "التوصيل القادم: " : "Next delivery: "}
                  {fmtShort(sub.nextDeliveryAt)}
                </p>
              )}

              {/* ── Actions per state — every button has its own pending state ── */}
              <div className="flex flex-wrap items-center gap-2">
                {status === "DRAFT" && !draftExpired && (
                  <>
                    <Button size="sm" loading={completing} onClick={() => completePayment(sub)}>
                      {!completing && <CreditCard className="size-4" aria-hidden />}
                      {isAr ? "أكمل الدفع" : "Complete payment"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={actionPending(sub.id, "cancel")}
                      onClick={() => action.mutate({ id: sub.id, verb: "cancel" })}
                    >
                      {isAr ? "إلغاء" : "Cancel"}
                    </Button>
                  </>
                )}
                {status === "DRAFT" && draftExpired && (
                  <Link href={freshCheckoutHref(sub)}>
                    <Button size="sm">
                      <RefreshCcw className="size-4" aria-hidden />
                      {isAr ? "ابدأ الدفع من جديد" : "Start a fresh checkout"}
                    </Button>
                  </Link>
                )}

                {status === "ACTIVE" && !wontRenew && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={actionPending(sub.id, "pause")}
                      onClick={() => action.mutate({ id: sub.id, verb: "pause" })}
                    >
                      {!actionPending(sub.id, "pause") && <Pause className="size-4" aria-hidden />}
                      {isAr ? "إيقاف مؤقت" : "Pause"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setCancelFor(sub)}>
                      <X className="size-4" aria-hidden />
                      {isAr ? "إلغاء التجديد" : "Cancel renewal"}
                    </Button>
                  </>
                )}

                {status === "PAUSED" && (
                  <Button
                    size="sm"
                    loading={actionPending(sub.id, "resume")}
                    onClick={() => action.mutate({ id: sub.id, verb: "resume" })}
                  >
                    {!actionPending(sub.id, "resume") && <Play className="size-4" aria-hidden />}
                    {isAr ? "استئناف" : "Resume"}
                  </Button>
                )}

                {status === "EXPIRED" && sub.cats[0] && (
                  <Link href={`/portal/subscribe?cat=${sub.cats[0].id}&renew=1`}>
                    <Button size="sm">
                      <RefreshCcw className="size-4" aria-hidden />
                      {isAr ? "جدّد العضوية" : "Renew membership"}
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          );
        })
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloCan tone="green" className="h-24 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "لا توجد اشتراكات بعد — صندوق شهري يوصل احتياج قطك إلى بابك، بدون أي تجديد تلقائي"
              : "No subscriptions yet — a monthly box brings your cat's needs to your door, never auto-renewed"}
          </p>
          <Link href="/portal/subscribe">
            <Button size="sm">{isAr ? "ابنِ باقة قطك" : "Build your cat's plan"}</Button>
          </Link>
        </Card>
      )}

      {/* ── The honest cancel conversation (R062/R063/R030) ─────────────────── */}
      <Dialog
        open={!!cancelFor}
        onClose={closeCancelDialog}
        title={isAr ? "إلغاء التجديد؟" : "Cancel renewal?"}
        description={
          cancelFor?.endsAt
            ? isAr
              ? `مدتكم مدفوعة حتى ${formatMoneyDate(cancelFor.endsAt, true)}. الإلغاء يعني أنها لن تتجدد فقط — كل ما دفعتم يصلكم كاملاً حتى نهايتها.`
              : `Your term is paid until ${formatMoneyDate(cancelFor.endsAt, false)}. Cancelling means it won't renew — everything you paid for still arrives.`
            : isAr
              ? "الإلغاء يعني أن الاشتراك لن يتجدد."
              : "Cancelling means the membership won't renew."
        }
        footer={
          <>
            <Button variant="ghost" onClick={closeCancelDialog}>
              {isAr ? "احتفظ بها" : "Keep it"}
            </Button>
            <Button
              variant="destructive"
              loading={!!cancelFor && actionPending(cancelFor.id, "cancel")}
              onClick={() => {
                if (!cancelFor) return;
                action.mutate(
                  { id: cancelFor.id, verb: "cancel" },
                  { onSuccess: closeCancelDialog }
                );
              }}
            >
              {isAr ? "نعم، لا تجدّدها" : "Yes, don't renew"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {/* Pause first — most "cancels" are really "not right now" (R062). */}
          <button
            type="button"
            disabled={!!cancelFor && actionPending(cancelFor.id, "pause")}
            onClick={() => {
              if (!cancelFor) return;
              action.mutate(
                { id: cancelFor.id, verb: "pause" },
                { onSuccess: closeCancelDialog }
              );
            }}
            className="flex w-full min-h-11 items-center gap-3 rounded-xl border border-border p-3 text-start text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <Pause className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0">
              <span className="block font-medium">
                {isAr ? "أوقفها مؤقتاً بدلاً من الإلغاء" : "Pause instead of cancelling"}
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {isAr
                  ? "أيامك تنحفظ كاملة وتُضاف لمدتك عند الاستئناف — وهوية قطك تبقى مفعّلة."
                  : "Your days are saved in full and added back when you resume — and your cat's ID stays active."}
              </span>
            </span>
          </button>

          {/* The refund stays safe to raise — a quiet path, never buried (R030). */}
          {cancelFor?.refundRequested ? (
            <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Undo2 className="size-3.5 shrink-0" aria-hidden />
              {isAr ? "طلب الاسترداد قيد المتابعة" : "Refund request in progress"}
            </p>
          ) : refundOpen ? (
            <div className="space-y-2 rounded-xl border border-border p-3">
              <label htmlFor="refund-reason" className="block text-xs font-medium text-muted-foreground">
                {isAr ? "سبب الطلب (اختياري)" : "Reason (optional)"}
              </label>
              <textarea
                id="refund-reason"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={isAr ? "أخبرنا كيف نتحسّن…" : "Tell us how we can do better…"}
                className="w-full resize-none rounded-xl border border-input bg-background p-3 text-sm text-foreground shadow-e1 outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
              <Button
                variant="outline"
                size="sm"
                loading={requestRefund.isPending}
                onClick={() => {
                  if (!cancelFor) return;
                  requestRefund.mutate({ id: cancelFor.id, reason: refundReason });
                }}
              >
                {isAr ? "أرسل طلب الاسترداد" : "Send refund request"}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setRefundOpen(true)}
              className="min-h-9 px-1 text-xs font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              {isAr ? "أو اطلب استرداد المبلغ المتبقي" : "Or request a refund of the remainder"}
            </button>
          )}
        </div>
      </Dialog>
    </div>
  );
}

/** Bilingual, non-alarmist state labels — never the raw DB word. */
function SubStatusBadge({
  status,
  wontRenew,
  isAr,
}: {
  status: SubStatus | string;
  wontRenew: boolean;
  isAr: boolean;
}) {
  if (wontRenew) {
    return <Badge variant="warning">{isAr ? "لن تتجدد" : "Won't renew"}</Badge>;
  }
  const map: Record<string, { variant: "success" | "secondary" | "warning" | "default"; en: string; ar: string }> = {
    ACTIVE: { variant: "success", en: "Active", ar: "نشطة" },
    PAUSED: { variant: "secondary", en: "Paused", ar: "موقوفة مؤقتاً" },
    DRAFT: { variant: "warning", en: "Awaiting payment", ar: "بانتظار الدفع" },
    // Dignified, not destructive — leaving is easy and never shamed (R068).
    CANCELLED: { variant: "secondary", en: "Cancelled", ar: "ملغاة" },
    EXPIRED: { variant: "secondary", en: "Ended", ar: "انتهت" },
    PAST_DUE: { variant: "warning", en: "Payment issue", ar: "مشكلة في الدفع" },
  };
  const s = map[status] ?? { variant: "secondary" as const, en: status, ar: status };
  return <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge>;
}
