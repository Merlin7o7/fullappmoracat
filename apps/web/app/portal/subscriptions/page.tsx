"use client";

// ════════════════════════════════════════════════════════════════════════
//  Subscriptions — the manage surface for the honest term model.
//
//  The member paid price × termMonths upfront; a term renews itself ONLY if
//  the member ticked auto-renew (T7) — and that truth is on every card.
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
  SkipForward,
  ArrowLeftRight,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card, Badge, Button, Skeleton, Dialog, useToast, cn } from "@moraqat/ui";
import { CANCEL_REASONS, CANCEL_REASON_LABELS, type CancelReasonCode } from "@moraqat/core";
import type { ApiPlan } from "@/lib/plan-recommend";
import { useSavedCards, brandLabel } from "@/components/saved-cards";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { formatDate, monthsLabel } from "@/lib/datetime";
import { formatSAR, formatAmount, formatMoneyDate } from "@/lib/money";
import { friendlyError } from "@/lib/errors";
import { QueryError } from "@/components/query-error";
import { MembershipsClosedNotice } from "@/components/membership";
import { commerceEnabled } from "@/lib/features";
import { IlloPaw } from "@/components/illustrations";
import { Illo3D } from "@/components/illo-3d";

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
  cancelReason: string | null;
  /** Opt-in auto-renew (T7) and the exact card it charges. */
  autoRenew: boolean;
  renewalPaymentMethod: { id: string; brand: string | null; last4: string | null } | null;
  dunningAttempts: number;
  graceUntil: string | null;
  /** A plan change waiting for the next renewal (T8). */
  pendingPlan: { id: string; tier: string; nameEn: string; nameAr: string } | null;
  refundRequested: boolean;
  resumeUrl: string | null;
  plan: { tier: string; nameEn: string; nameAr: string } | null;
  cats: { id: string; name: string }[];
  items: { nameEn: string; quantity: number }[];
}

type Verb = "pause" | "resume" | "cancel" | "skip";

export default function SubscriptionsPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto max-w-4xl"><Skeleton className="h-40 w-full" /></div>}>
      <SubscriptionsInner />
    </React.Suspense>
  );
}

function SubscriptionsInner() {
  const { authedFetch, user } = useAuth();
  const search = useSearchParams();
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
  // T8: the honest cancel asks ONE optional question; a plan change waits for
  // the next renewal. "Don't renew this time" arrives from the T-7 mail (T7).
  const [cancelReason, setCancelReason] = React.useState<CancelReasonCode | null>(null);
  const [cancelNote, setCancelNote] = React.useState("");
  const [planFor, setPlanFor] = React.useState<Sub | null>(null);
  const [planPick, setPlanPick] = React.useState<string | null>(null);
  const [skipRenewalFor, setSkipRenewalFor] = React.useState<string | null>(() => search.get("skip"));

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["subscriptions", user?.id],
    queryFn: () => authedFetch<Sub[]>("/subscriptions"),
    enabled: !!user && commerce,
  });
  const cards = useSavedCards(commerce);
  const defaultCard = cards.data?.find((c) => c.isDefault) ?? cards.data?.[0] ?? null;
  const plansQ = useQuery({
    queryKey: ["plans"],
    queryFn: () => authedFetch<ApiPlan[]>("/plans"),
    enabled: !!user && commerce && !!planFor,
  });

  const closeCancelDialog = () => {
    setCancelFor(null);
    setRefundOpen(false);
    setRefundReason("");
    setCancelReason(null);
    setCancelNote("");
  };

  const doneCopy: Record<Verb, { en: string; ar: string }> = {
    pause: { en: "Membership paused — your days are saved", ar: "تم الإيقاف المؤقت — أيامك محفوظة" },
    resume: { en: "Welcome back — membership resumed", ar: "أهلاً بعودتك — استؤنفت العضوية" },
    cancel: { en: "It won't renew — everything you paid for still arrives", ar: "لن تتجدد — وكل ما دفعته يصلك كاملاً" },
    skip: { en: "Next box skipped — your term end doesn't move", ar: "تخطّينا الصندوق القادم — ونهاية مدتك ما تتغير" },
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

  // The honest cancel (T8): reason is optional and never argued with (R068).
  const cancelSub = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      authedFetch(`/subscriptions/${id}/cancel`, {
        method: "POST",
        body: JSON.stringify({
          ...(cancelReason ? { reason: cancelReason } : {}),
          ...(cancelNote.trim() ? { note: cancelNote.trim() } : {}),
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      void qc.invalidateQueries({ queryKey: ["cats"] });
      const grieving = cancelReason === "CAT_PASSED";
      closeCancelDialog();
      toast({
        title: grieving
          ? isAr ? "نحن معك. سجلّه وذكرياته محفوظة معك دائماً" : "We're with you. Their record and memories stay with you, always"
          : isAr ? doneCopy.cancel.ar : doneCopy.cancel.en,
        variant: "default",
      });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });

  // Auto-renew on/off (T7). Off is one tap; on names the exact card.
  const setAutoRenew = useMutation({
    mutationFn: ({ id, enabled, paymentMethodId }: { id: string; enabled: boolean; paymentMethodId?: string }) =>
      authedFetch<{ autoRenew: boolean; notice?: { ar: string; en: string } }>(`/subscriptions/${id}/auto-renew`, {
        method: "POST",
        body: JSON.stringify({ enabled, ...(paymentMethodId ? { paymentMethodId } : {}) }),
      }),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setSkipRenewalFor(null);
      toast({
        title: res.notice ? (isAr ? res.notice.ar : res.notice.en) : isAr ? "تم" : "Done",
        variant: res.autoRenew ? "success" : "default",
      });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });
  const autoRenewPending = (id: string) => setAutoRenew.isPending && setAutoRenew.variables?.id === id;

  // Plan change (T8) — takes effect at the next renewal, never mid-term.
  const changePlan = useMutation({
    mutationFn: ({ id, planId }: { id: string; planId: string }) =>
      authedFetch(`/subscriptions/${id}/change-plan`, { method: "POST", body: JSON.stringify({ planId }) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["subscriptions"] });
      setPlanFor(null);
      setPlanPick(null);
      toast({
        title: isAr ? "سجّلنا التغيير — يبدأ مع التجديد القادم" : "Change noted — it starts with your next renewal",
        variant: "success",
      });
    },
    onError: (e) => {
      const fe = friendlyError(e, isAr);
      toast({ title: fe.title, description: fe.message, variant: "error" });
    },
  });

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
            ? "مدفوعة مقدماً، وتتجدد فقط إذا طلبت — أوقف مؤقتاً أو تخطَّ أو ألغِ أو اطلب استرداداً في أي وقت"
            : "Paid upfront, renewed only if you ask — pause, skip, cancel, or request a refund anytime"}
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

              {/* The renewal truth (T7, R021/R025): what happens at term end,
                  the exact card, and the one-tap way to change it. */}
              {(status === "ACTIVE" || status === "PAUSED") && !wontRenew && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-4 text-sm">
                  <span className="flex min-w-0 items-start gap-2">
                    <RefreshCcw className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      {sub.autoRenew && sub.renewalPaymentMethod ? (
                        isAr ? (
                          <>
                            تتجدد تلقائياً في {sub.endsAt ? formatMoneyDate(sub.endsAt, true) : "—"} على{" "}
                            <span dir="ltr">{brandLabel(sub.renewalPaymentMethod.brand, "")} •••• {sub.renewalPaymentMethod.last4}</span> — نذكّرك قبلها بسبعة أيام ويوم واحد.
                          </>
                        ) : (
                          <>
                            Renews automatically on {sub.endsAt ? formatMoneyDate(sub.endsAt, false) : "—"} on{" "}
                            <span dir="ltr">{brandLabel(sub.renewalPaymentMethod.brand, "")} •••• {sub.renewalPaymentMethod.last4}</span> — we remind you 7 days and 1 day before.
                          </>
                        )
                      ) : isAr ? (
                        "لا تتجدد تلقائياً — ندعوك قبل نهاية مدتك."
                      ) : (
                        "Doesn't renew itself — we invite you before your term ends."
                      )}
                    </span>
                  </span>
                  {sub.autoRenew ? (
                    <Button variant="ghost" size="sm" loading={autoRenewPending(sub.id)} onClick={() => setAutoRenew.mutate({ id: sub.id, enabled: false })}>
                      {isAr ? "أوقف التجديد التلقائي" : "Turn off auto-renew"}
                    </Button>
                  ) : defaultCard ? (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={autoRenewPending(sub.id)}
                      onClick={() => setAutoRenew.mutate({ id: sub.id, enabled: true, paymentMethodId: defaultCard.id })}
                    >
                      <span dir="ltr">{isAr ? `جدّد تلقائياً على •••• ${defaultCard.last4}` : `Renew automatically on •••• ${defaultCard.last4}`}</span>
                    </Button>
                  ) : null}
                </div>
              )}

              {/* Dunning (T7): a failed renewal keeps benefits through the grace week — say so, and point at the fix. */}
              {status === "ACTIVE" && sub.dunningAttempts > 0 && sub.graceUntil && (
                <p className="mb-4 rounded-xl bg-warning/10 p-4 text-sm text-[hsl(38_92%_26%)] dark:text-warning-ink">
                  {isAr
                    ? `ما نجح التجديد على البطاقة المحفوظة — مزاياكم مستمرة حتى ${formatMoneyDate(sub.graceUntil, true)}. حدّث البطاقة ونكمل. `
                    : `The renewal didn't go through on the saved card — your benefits continue until ${formatMoneyDate(sub.graceUntil, false)}. Update the card and we'll finish it. `}
                  <Link href="/portal/settings" className="font-semibold underline underline-offset-4">{isAr ? "الإعدادات" : "Settings"}</Link>
                </p>
              )}

              {/* A plan change waiting for the next renewal (T8). */}
              {sub.pendingPlan && (
                <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <ArrowLeftRight className="size-4 shrink-0" aria-hidden />
                  {isAr ? `تنتقل إلى باقة «${sub.pendingPlan.nameAr}» مع التجديد القادم.` : `Switching to the ${sub.pendingPlan.nameEn} plan at your next renewal.`}
                </p>
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
                <p className="mb-4 rounded-xl bg-warning/10 p-4 text-sm text-[hsl(38_92%_26%)] dark:text-warning-ink">
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
                <p className="mb-4 rounded-xl bg-warning/10 p-4 text-sm text-[hsl(38_92%_26%)] dark:text-warning-ink">
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
                    <Button
                      variant="outline"
                      size="sm"
                      loading={actionPending(sub.id, "skip")}
                      onClick={() => action.mutate({ id: sub.id, verb: "skip" })}
                    >
                      {!actionPending(sub.id, "skip") && <SkipForward className="size-4" aria-hidden />}
                      {isAr ? "تخطَّ الصندوق القادم" : "Skip next box"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setPlanFor(sub);
                        setPlanPick(sub.pendingPlan?.id ?? null);
                      }}
                    >
                      <ArrowLeftRight className="size-4" aria-hidden />
                      {isAr ? "غيّر الباقة" : "Change plan"}
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
          <Illo3D name="can" className="size-28" px={112} />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "لا توجد اشتراكات بعد — صندوق شهري يوصل احتياج قطك إلى بابك، ويتجدد فقط إذا طلبت"
              : "No subscriptions yet — a monthly box brings your cat's needs to your door, renewed only if you ask"}
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
              loading={cancelSub.isPending}
              onClick={() => {
                if (!cancelFor) return;
                cancelSub.mutate({ id: cancelFor.id });
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

          {/* One optional question, never argued with (T8, R068). */}
          <fieldset className="space-y-1">
            <legend className="mb-1 px-1 text-xs font-medium text-muted-foreground">
              {isAr ? "إذا حبيت تخبرنا — ليش؟ (اختياري)" : "If you'd like to tell us — why? (optional)"}
            </legend>
            {CANCEL_REASONS.map((r) => (
              <label
                key={r}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm transition-colors",
                  cancelReason === r ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={r}
                  checked={cancelReason === r}
                  onChange={() => setCancelReason(r)}
                  className="accent-primary"
                />
                {isAr ? CANCEL_REASON_LABELS[r].ar : CANCEL_REASON_LABELS[r].en}
              </label>
            ))}
            {cancelReason === "CAT_PASSED" && (
              <p className="px-2 pt-1 text-xs leading-relaxed text-muted-foreground">
                {isAr ? "نحن معك. سجلّه وصوره وهويته تبقى محفوظة معك دائماً." : "We're so sorry. Their record, photos and ID stay with you, always."}
              </p>
            )}
            {(cancelReason === "SERVICE_ISSUE" || cancelReason === "OTHER") && (
              <textarea
                rows={2}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder={isAr ? "أخبرنا أكثر إذا حبيت…" : "Tell us more if you'd like…"}
                className="mt-1 w-full resize-none rounded-xl border border-input bg-background p-3 text-sm text-foreground shadow-e1 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
          </fieldset>

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

      {/* ── Change plan — applied at the next renewal, never mid-term (T8) ─── */}
      <Dialog
        open={!!planFor}
        onClose={() => {
          setPlanFor(null);
          setPlanPick(null);
        }}
        title={isAr ? "تغيير الباقة" : "Change plan"}
        description={
          isAr
            ? "مدتك المدفوعة تبقى كما هي. الباقة الجديدة تبدأ مع التجديد القادم، وبالسعر الظاهر هنا."
            : "Your paid term stays exactly as it is. The new plan starts with your next renewal, at the price shown here."
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setPlanFor(null);
                setPlanPick(null);
              }}
            >
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              loading={changePlan.isPending}
              disabled={!planPick || !planFor}
              onClick={() => planFor && planPick && changePlan.mutate({ id: planFor.id, planId: planPick })}
            >
              {isAr ? "اعتمد التغيير" : "Confirm change"}
            </Button>
          </>
        }
      >
        {plansQ.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div role="radiogroup" aria-label={isAr ? "الباقات" : "Plans"} className="space-y-2">
            {(plansQ.data ?? [])
              .filter((p) => (p.maxCats ?? 1) >= (planFor?.cats.length ?? 1))
              .map((p) => {
                const selected = planPick === p.id;
                const current = planFor?.plan?.tier === p.tier;
                const cats = planFor?.cats.length ?? 1;
                const monthly = Math.round((p.price + (p.modulePriceSar ?? 0) * Math.max(0, cats - 1)) * 100) / 100;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setPlanPick(p.id)}
                    className={cn(
                      "flex w-full min-h-11 items-center justify-between gap-3 rounded-xl border p-3 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected ? "border-primary bg-primary/[0.06]" : "border-border hover:bg-muted/50"
                    )}
                  >
                    <span className="text-sm font-semibold">
                      {isAr ? p.nameAr : p.nameEn}
                      {current && <span className="ms-2 text-xs font-normal text-muted-foreground">{isAr ? "(الحالية)" : "(current)"}</span>}
                    </span>
                    <span dir="ltr" className="tabular text-sm">
                      {formatSAR(monthly, isAr)}
                      <span className="text-xs text-muted-foreground">{isAr ? " / شهر" : " / mo"}</span>
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </Dialog>

      {/* ── "Don't renew this time" — the one-tap out promised in the T-7 mail (T7, R025) ── */}
      <Dialog
        open={!!skipRenewalFor && !!data?.some((s) => s.id === skipRenewalFor && s.autoRenew)}
        onClose={() => setSkipRenewalFor(null)}
        title={isAr ? "لا تجدّدها هالمرة؟" : "Don't renew this time?"}
        description={
          isAr
            ? "نوقف التجديد التلقائي. مدتك المدفوعة تكمل كما هي، وما نخصم منك شيء بعدها — وتقدر تفعّله متى ما حبيت."
            : "We'll switch auto-renew off. Your paid term runs to the end, nothing is charged after it — and you can switch it back on whenever you like."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSkipRenewalFor(null)}>{isAr ? "خلّها تتجدد" : "Keep renewing"}</Button>
            <Button loading={setAutoRenew.isPending} onClick={() => skipRenewalFor && setAutoRenew.mutate({ id: skipRenewalFor, enabled: false })}>
              {isAr ? "نعم، لا تجدّدها" : "Yes, don't renew"}
            </Button>
          </>
        }
      >
        <span className="sr-only">{isAr ? "تأكيد" : "Confirm"}</span>
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
