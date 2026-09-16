"use client";

/**
 * The "why" of a clinic's current state, kept on screen: the change request
 * that sent it back, the reason it was refused or stopped, and — while it
 * waits on review — every gap still blocking approval. A decision's reason
 * must outlive the person who made it.
 */

import * as React from "react";
import { AlertTriangle, MessageSquareWarning, ListChecks, StickyNote, XCircle, X } from "lucide-react";
import { REGISTRATION_STEPS } from "@moraqat/core";
import { cn } from "@moraqat/ui";
import type { RegistrationState } from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { GapList } from "./shared";
import type { ActionError } from "./use-clinic-actions";

function Banner({
  tone,
  icon: Icon,
  title,
  children,
  onDismiss,
  isAr,
  role,
}: {
  tone: "destructive" | "warning" | "info" | "neutral";
  icon: typeof AlertTriangle;
  title: string;
  children?: React.ReactNode;
  onDismiss?: () => void;
  isAr: boolean;
  role?: "alert" | "status";
}) {
  const toneClass = {
    destructive: "border-destructive/30 bg-destructive/5",
    warning: "border-warning/40 bg-warning/10",
    info: "border-info/30 bg-info/5",
    neutral: "border-border bg-muted/40",
  }[tone];
  const iconClass = {
    destructive: "text-destructive",
    warning: "text-[hsl(38_92%_32%)] dark:text-warning",
    info: "text-info",
    neutral: "text-muted-foreground",
  }[tone];
  return (
    <div role={role} className={cn("relative flex items-start gap-3 rounded-2xl border p-4", toneClass, onDismiss && "pe-12")}>
      <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={isAr ? "إخفاء" : "Dismiss"}
          className="absolute end-1 top-1 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}

export function ReviewBanners({
  state,
  error,
  onDismissError,
  isAr,
}: {
  state: RegistrationState;
  error: ActionError | null;
  onDismissError: () => void;
  isAr: boolean;
}) {
  const { org, admin } = state;
  const inReview = org.status === "SUBMITTED" || org.status === "IN_REVIEW";
  const stepLabel = (key: string) => {
    const s = REGISTRATION_STEPS.find((x) => x.key === key);
    return s ? (isAr ? s.ar : s.en) : key;
  };

  return (
    <div className="space-y-3 empty:hidden">
      {error && (
        <Banner tone="destructive" icon={XCircle} title={error.title} onDismiss={onDismissError} isAr={isAr} role="alert">
          <p>{error.message}</p>
          {error.gaps && error.gaps.length > 0 && <GapList gaps={error.gaps} isAr={isAr} className="mt-2 text-foreground" />}
        </Banner>
      )}

      {org.status === "SUSPENDED" && (
        <Banner
          tone="destructive"
          icon={AlertTriangle}
          title={
            admin?.suspendedAt
              ? isAr
                ? `موقوفة منذ ${fmtDate(admin.suspendedAt, true)}`
                : `Suspended ${fmtDate(admin.suspendedAt, false)}`
              : isAr
                ? "العيادة موقوفة"
                : "Clinic suspended"
          }
          isAr={isAr}
        >
          {admin?.suspendReason || (isAr ? "لم يُسجَّل سبب." : "No reason recorded.")}
        </Banner>
      )}

      {org.status === "REJECTED" && (
        <Banner tone="destructive" icon={XCircle} title={isAr ? "سبب الرفض" : "Reason for rejection"} isAr={isAr}>
          {org.rejectedReason || (isAr ? "لم يُسجَّل سبب." : "No reason recorded.")}
        </Banner>
      )}

      {org.changesRequestedNote && (org.status === "CHANGES_REQUESTED" || inReview) && (
        <Banner
          tone="warning"
          icon={MessageSquareWarning}
          title={
            org.status === "CHANGES_REQUESTED"
              ? isAr
                ? "بانتظار تعديلات العيادة"
                : "Waiting on the clinic's changes"
              : isAr
                ? "آخر طلب تعديلات (أُعيد الإرسال بعده)"
                : "Last change request (resubmitted since)"
          }
          isAr={isAr}
        >
          <p className="whitespace-pre-line text-foreground">{org.changesRequestedNote}</p>
          {org.changesRequestedSteps.length > 0 && (
            <p className="mt-2">
              {isAr ? "الأقسام المفتوحة: " : "Reopened: "}
              {org.changesRequestedSteps.map(stepLabel).join(isAr ? "، " : ", ")}
            </p>
          )}
        </Banner>
      )}

      {inReview && state.gaps.length > 0 && (
        <Banner
          tone="warning"
          icon={ListChecks}
          title={
            isAr
              ? `ينقص التسجيل ${state.gaps.length.toLocaleString("ar-SA")} بند — لا يمكن القبول قبل إكمالها`
              : `${state.gaps.length} gap${state.gaps.length === 1 ? "" : "s"} block approval`
          }
          isAr={isAr}
        >
          <GapList gaps={state.gaps} isAr={isAr} className="text-foreground" />
          <p className="mt-2">
            {isAr
              ? "اطلب تعديلات وحدّد الأقسام المعنية لتفتحها للعيادة."
              : "Request changes and tick the sections involved to reopen them for the clinic."}
          </p>
        </Banner>
      )}

      {admin?.inviteNote && (
        <Banner tone="neutral" icon={StickyNote} title={isAr ? "ملاحظة داخلية (لا تظهر للعيادة)" : "Internal note (never shown to the clinic)"} isAr={isAr}>
          <p className="whitespace-pre-line">{admin.inviteNote}</p>
        </Banner>
      )}
    </div>
  );
}
