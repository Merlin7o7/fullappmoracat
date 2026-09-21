"use client";

/**
 * What the owner sees once the wizard is no longer the point: waiting for
 * review, approved and setting up, live, or turned down. Each screen answers
 * the only three questions that matter — where do I stand, what happens next,
 * and who do I talk to (R084).
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, Clock, Mail, MessageSquareWarning, PartyPopper, ShieldCheck, XCircle } from "lucide-react";
import { Badge, Card, buttonVariants, cn } from "@moraqat/ui";
import { GO_LIVE_ITEMS, REGISTRATION_STEPS, VET_ROLE_LABELS } from "@moraqat/core";
import type { RegistrationApi, RegistrationState } from "@/lib/vet-registration";
import { IlloCat, IlloHeart, IlloPaw } from "@/components/illustrations";
import { FullSummary } from "./summary";
import { formatDate } from "./ui";

export const PARTNERS_EMAIL = "partners@moracat.co";

function orgName(state: RegistrationState, isAr: boolean) {
  return isAr ? state.org.nameAr || state.org.nameEn : state.org.nameEn || state.org.nameAr;
}

function Hero({
  icon,
  tone,
  eyebrow,
  title,
  children,
  art,
}: {
  icon: React.ReactNode;
  tone: "primary" | "success" | "muted";
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
  art?: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-col items-start gap-3 overflow-hidden rounded-3xl bg-card p-6 shadow-e1 ring-1 ring-border sm:p-8">
      {art && (
        <span aria-hidden className="pointer-events-none absolute -bottom-3 end-3 opacity-90">
          {art}
        </span>
      )}
      <span
        className={cn(
          "grid size-12 place-items-center rounded-2xl",
          tone === "primary" && "bg-primary/10 text-primary",
          tone === "success" && "bg-success/12 text-success",
          tone === "muted" && "bg-muted text-muted-foreground"
        )}
        aria-hidden
      >
        {icon}
      </span>
      {eyebrow && <p className="text-xs font-medium text-muted-foreground">{eyebrow}</p>}
      <h1 className="max-w-lg font-display text-2xl font-semibold leading-tight">{title}</h1>
      {children && <div className="relative max-w-lg text-sm leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
}

function Contact({ isAr }: { isAr: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      {isAr ? "سؤال؟ راسلنا على " : "Questions? Write to "}
      <a href={`mailto:${PARTNERS_EMAIL}`} dir="ltr" className="font-medium text-primary underline-offset-4 hover:underline">
        {PARTNERS_EMAIL}
      </a>
    </p>
  );
}

/* ── Submitted / in review ─────────────────────────────────────────────── */

export function UnderReviewScreen({
  state,
  isAr,
  api,
  orgId,
}: {
  state: RegistrationState;
  isAr: boolean;
  api: RegistrationApi;
  orgId: string;
}) {
  const inReview = state.org.status === "IN_REVIEW";
  const steps = [
    {
      done: true,
      ar: `أُرسل الطلب${state.org.submittedAt ? ` · ${formatDate(state.org.submittedAt, true)}` : ""}`,
      en: `Registration submitted${state.org.submittedAt ? ` · ${formatDate(state.org.submittedAt, false)}` : ""}`,
    },
    {
      done: inReview,
      current: !inReview,
      ar: "يستلمه فريق مراجعة الشركاء",
      en: "Our partner review team picks it up",
    },
    {
      done: false,
      current: inReview,
      // Honest about the method (R040): a person reads the uploaded papers —
      // there is no automated registry lookup yet.
      ar: "يراجع فريقنا السجل التجاري والتراخيص التي رفعتموها",
      en: "Our team reviews the CR and licences you uploaded",
    },
    { done: false, ar: "القرار — يصلك بالبريد مع الخطوة التالية", en: "A decision — by email, with the next step" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Hero
        icon={<Clock className="size-6" />}
        tone="primary"
        eyebrow={orgName(state, isAr)}
        title={inReview ? (isAr ? "طلبكم قيد المراجعة" : "Your registration is being reviewed") : isAr ? "وصلنا طلبكم — شكراً لكم" : "We've got your registration — thank you"}
        art={<IlloCat tone="sage" className="size-20 sm:size-24" />}
      >
        {isAr
          ? "تستغرق المراجعة عادةً ٥ إلى ٧ أيام عمل. نرسل لكم بريداً عند كل خطوة، فلا حاجة لمتابعة هذه الصفحة. إن احتجنا توضيحاً سنطلبه بالتحديد."
          : "Review usually takes 5–7 working days. We email you at every step, so there's no need to keep checking this page. If we need anything, we'll ask for exactly that."}
      </Hero>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 font-display text-base font-semibold">{isAr ? "ماذا يحدث الآن" : "What happens next"}</h2>
        <ol className="flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              {s.done ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              ) : (
                <Circle className={cn("mt-0.5 size-5 shrink-0", s.current ? "text-primary" : "text-muted-foreground/40")} aria-hidden />
              )}
              <span className={cn(s.current && "font-medium", !s.done && !s.current && "text-muted-foreground")}>
                {isAr ? s.ar : s.en}
                <span className="sr-only">
                  {s.done ? (isAr ? " (تم)" : " (done)") : s.current ? (isAr ? " (الآن)" : " (now)") : ""}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <InvitesCard state={state} isAr={isAr} />

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{isAr ? "ما أرسلتموه" : "What you sent"}</h2>
          <p className="text-xs text-muted-foreground">
            {isAr ? "للاطلاع فقط — الطلب مقفل أثناء المراجعة." : "For reference — the registration is locked while it's reviewed."}
          </p>
        </div>
        <FullSummary state={state} isAr={isAr} api={api} orgId={orgId} />
        {state.terms.accepted?.signedAt && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-primary" aria-hidden />
            {isAr
              ? `وقّع ${state.terms.accepted.signedByName ?? ""} على اتفاقية الشراكة (الإصدار ${state.terms.accepted.termsVersion ?? ""}) في ${formatDate(state.terms.accepted.signedAt, true)}.`
              : `${state.terms.accepted.signedByName ?? ""} signed the partner agreement (version ${state.terms.accepted.termsVersion ?? ""}) on ${formatDate(state.terms.accepted.signedAt, false)}.`}
          </p>
        )}
      </section>

      <Contact isAr={isAr} />
    </div>
  );
}

function InvitesCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  if (!state.invites.length) return null;
  const badge = (s: "pending" | "accepted" | "expired") =>
    s === "accepted" ? (
      <Badge variant="success" dot>
        {isAr ? "أنشأ حسابه" : "Joined"}
      </Badge>
    ) : s === "expired" ? (
      <Badge variant="destructive" dot>
        {isAr ? "انتهت الدعوة" : "Expired"}
      </Badge>
    ) : (
      <Badge variant="warning" dot>
        {isAr ? "بانتظار القبول" : "Pending"}
      </Badge>
    );
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold">{isAr ? "دعوات الفريق" : "Team invitations"}</h2>
      <p className="mb-3 mt-0.5 text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "أُرسلت لحظة إرسال الطلب. يستطيعون إنشاء حساباتهم الآن، وتُفتح لهم سجلات الأعضاء بعد تفعيل العيادة."
          : "Sent when you submitted. They can create their accounts now; member records open once the clinic is live."}
      </p>
      <ul className="flex flex-col divide-y divide-border">
        {state.invites.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{inv.fullName || inv.email}</p>
              <p className="truncate text-xs text-muted-foreground">
                {(inv.roleLabel ?? VET_ROLE_LABELS[inv.role])[isAr ? "ar" : "en"]} · <span dir="ltr">{inv.email}</span>
              </p>
            </div>
            {badge(inv.state)}
          </li>
        ))}
      </ul>
      {state.invites.some((i) => i.state === "expired") && (
        <p className="mt-3 text-xs text-muted-foreground">
          {isAr
            ? `لإعادة إرسال دعوة منتهية راسلنا على ${PARTNERS_EMAIL}.`
            : `To resend an expired invitation, write to ${PARTNERS_EMAIL}.`}
        </p>
      )}
    </Card>
  );
}

/* ── Approved ──────────────────────────────────────────────────────────── */

export function ApprovedScreen({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <Hero
        icon={<PartyPopper className="size-6" />}
        tone="success"
        eyebrow={orgName(state, isAr)}
        title={isAr ? "تم قبول عيادتكم في شبكة مرقط" : "Your clinic is approved for the Moracat network"}
        art={<IlloHeart tone="orange" className="size-16 sm:size-20" />}
      >
        {isAr
          ? "بقيت خطوات تجهيز قصيرة داخل بوابة العيادات، ثم نفعّل العيادة ويبدأ الأعضاء بزيارتكم."
          : "A few short setup steps inside the partner portal, then we switch the clinic live and members can start visiting."}
      </Hero>
      <Card className="p-5 sm:p-6">
        <h2 className="mb-4 font-display text-base font-semibold">{isAr ? "قائمة التجهيز" : "Go-live checklist"}</h2>
        <ol className="flex flex-col gap-3">
          {GO_LIVE_ITEMS.map((item, i) => (
            <li key={item.key} className="flex items-start gap-3">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary tabular" aria-hidden>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium">
                  {isAr ? item.ar : item.en}
                  {!item.required && (
                    <span className="ms-1.5 text-xs font-normal text-muted-foreground">{isAr ? "(اختياري)" : "(optional)"}</span>
                  )}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{isAr ? item.hintAr : item.hintEn}</span>
              </span>
            </li>
          ))}
        </ol>
        <Link href="/vet" className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full sm:w-auto")}>
          {isAr ? "افتح بوابة العيادات" : "Open the partner portal"}
        </Link>
      </Card>
      <InvitesCard state={state} isAr={isAr} />
      <Contact isAr={isAr} />
    </div>
  );
}

/* ── Live ──────────────────────────────────────────────────────────────── */

export function LiveScreen({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const router = useRouter();
  React.useEffect(() => {
    const t = window.setTimeout(() => router.replace("/vet"), 2500);
    return () => window.clearTimeout(t);
  }, [router]);
  return (
    <div className="flex flex-col gap-6">
      <Hero
        icon={<CheckCircle2 className="size-6" />}
        tone="success"
        eyebrow={orgName(state, isAr)}
        title={isAr ? "عيادتكم فعّالة" : "Your clinic is live"}
        art={<IlloPaw tone="butter" className="size-16" />}
      >
        {isAr ? "التسجيل مكتمل. ننقلكم إلى بوابة العيادات…" : "Registration is complete. Taking you to the partner portal…"}
      </Hero>
      <Link href="/vet" className={cn(buttonVariants({ size: "lg" }), "self-start")}>
        {isAr ? "افتح بوابة العيادات" : "Open the partner portal"}
      </Link>
    </div>
  );
}

/* ── Rejected ──────────────────────────────────────────────────────────── */

export function RejectedScreen({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <Hero icon={<XCircle className="size-6" />} tone="muted" eyebrow={orgName(state, isAr)} title={isAr ? "لم نتمكن من قبول الطلب هذه المرة" : "We couldn't approve this registration"}>
        {isAr
          ? "نعرف أن هذا ليس ما كنتم تنتظرونه. السبب أدناه كما كتبه فريق المراجعة — وإن تغيّر شيء، يسعدنا أن نراجع من جديد."
          : "We know this isn't the answer you hoped for. The reason is below, exactly as the review team wrote it — and if something changes, we'd be glad to look again."}
      </Hero>
      {state.org.rejectedReason && (
        <Card className="p-5 sm:p-6">
          <h2 className="mb-2 text-sm font-semibold">{isAr ? "السبب" : "The reason"}</h2>
          <p dir="auto" className="whitespace-pre-line text-sm leading-relaxed">
            {state.org.rejectedReason}
          </p>
        </Card>
      )}
      <Card className="flex flex-col gap-2 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Mail className="size-4 text-primary" aria-hidden />
          {isAr ? "تحدّث معنا" : "Talk to us"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAr ? "إن كان لديكم مستند جديد أو توضيح، راسلونا وسنرد خلال يومي عمل." : "If you have a new document or want to explain something, write to us — we reply within two working days."}
        </p>
        <a href={`mailto:${PARTNERS_EMAIL}`} dir="ltr" className={cn(buttonVariants({ variant: "outline" }), "self-start")}>
          {PARTNERS_EMAIL}
        </a>
      </Card>
    </div>
  );
}

/* ── Anything else (suspended, offboarded, legacy) ─────────────────────── */

export function OtherStatusScreen({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <Hero icon={<Clock className="size-6" />} tone="muted" eyebrow={orgName(state, isAr)} title={isAr ? state.org.statusLabel.ar : state.org.statusLabel.en}>
        {isAr
          ? "لا يمكن تعديل التسجيل في هذه الحالة. تواصلوا معنا وسنساعدكم في الخطوة المناسبة."
          : "The registration can't be edited in this state. Get in touch and we'll help with the right next step."}
      </Hero>
      <Contact isAr={isAr} />
    </div>
  );
}

/* ── Changes requested banner ──────────────────────────────────────────── */

export function ChangesRequestedBanner({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const steps = state.org.changesRequestedSteps
    .map((s) => REGISTRATION_STEPS.find((x) => x.key === s))
    .filter(Boolean)
    .map((s) => (isAr ? s!.ar : s!.en));
  return (
    <div role="status" className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/[0.08] p-4 sm:p-5">
      <MessageSquareWarning className="mt-0.5 size-5 shrink-0 text-[hsl(38_92%_32%)] dark:text-warning-ink" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-display text-base font-semibold">{isAr ? "طلب فريق المراجعة بعض التعديلات" : "The review team asked for a few changes"}</p>
        {state.org.changesRequestedNote && (
          <blockquote dir="auto" className="mt-2 whitespace-pre-line border-s-2 border-warning/60 ps-3 text-sm leading-relaxed">
            {state.org.changesRequestedNote}
          </blockquote>
        )}
        {steps.length > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {isAr ? `الأقسام المفتوحة للتعديل: ${steps.join("، ")}. بقية الأقسام للاطلاع فقط.` : `Open for changes: ${steps.join(", ")}. Everything else is read-only.`}
          </p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          {isAr ? "عدّل ما طُلب، ثم أعد الإرسال من خطوة «المراجعة والشروط»." : "Make the changes, then resubmit from the Review & terms step."}
        </p>
      </div>
    </div>
  );
}
