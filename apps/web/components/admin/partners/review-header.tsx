"use client";

/**
 * The review workspace header: who this clinic is, where it stands, and only
 * the actions that make sense for that status. A disabled action always says
 * why and what's left (R084, R115) — never a button that silently won't work.
 *
 * Irreversible or clinic-facing decisions are confirmed (R116); reject and
 * suspend carry a written reason because the clinic is told it and it lives
 * in the audit trail.
 */

import * as React from "react";
import {
  Check,
  X,
  Send,
  Undo2,
  MessageSquareWarning,
  Rocket,
  ShieldCheck,
  ShieldOff,
  PauseCircle,
  PlayCircle,
  FlaskConical,
  Clock,
} from "lucide-react";
import { Badge, Button, useToast } from "@moraqat/ui";
import type { RegistrationState } from "@/lib/vet-registration";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { fmtDate } from "@/app/admin/_components/i18n";
import { RequestChangesDialog } from "./request-changes-dialog";
import { clinicStatusVariant, daysSince, fmtNumber } from "./shared";
import type { ClinicActions } from "./use-clinic-actions";

type DialogKind = "revoke" | "approve" | "request-changes" | "reject" | "go-live" | "verify" | "unverify" | "suspend" | "unsuspend";

const destructiveBtn = "border-destructive/40 text-destructive hover:bg-destructive/10";

export function ReviewHeader({ state, actions, isAr }: { state: RegistrationState; actions: ClinicActions; isAr: boolean }) {
  const { toast } = useToast();
  const [dialog, setDialog] = React.useState<DialogKind | null>(null);
  const { org, admin } = state;
  const status = org.status;
  const pending = actions.pendingKind;
  const close = () => setDialog(null);

  const name = (isAr ? org.nameAr : org.nameEn) || org.nameEn || org.nameAr;
  const otherName = isAr ? org.nameEn : org.nameAr;

  const inReview = status === "SUBMITTED" || status === "IN_REVIEW";
  const preSubmit = status === "INVITED" || status === "REGISTERING" || status === "CHANGES_REQUESTED";

  // Approval gate — mirrors the API (VET_REG_INCOMPLETE / VET_REG_DOCS_UNVERIFIED).
  const unverifiedRequired = state.documents.filter((d) => d.required && !d.verified).length;
  const gapCount = state.gaps.length;
  const remaining = gapCount + unverifiedRequired;
  const canApprove = remaining === 0;

  const testScanAt = admin?.checklist.testScanAt ?? null;
  const canGoLive = !!testScanAt || !!admin?.isDemo;

  const waited = inReview ? daysSince(org.submittedAt) : null;

  /** Reason-required confirm: say so out loud rather than a confirm that does nothing (R084). */
  const withReason = (min: number, run: (reason: string) => void) => (reason?: string) => {
    const r = reason?.trim() ?? "";
    if (r.length >= min) return run(r);
    toast({
      title: isAr ? "السبب مطلوب" : "A reason is required",
      description: isAr
        ? `اكتب سبباً واضحاً (${fmtNumber(min, true)} أحرف على الأقل) — ستُبلَّغ به العيادة ويُحفظ في سجل التدقيق.`
        : `Write a clear reason (at least ${min} characters) — the clinic is told it and it's kept in the audit trail.`,
      variant: "error",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
            <Badge variant={clinicStatusVariant(status)}>{isAr ? org.statusLabel.ar : org.statusLabel.en}</Badge>
            {org.verified && (
              <Badge variant="success">
                <ShieldCheck aria-hidden className="size-3" />
                {isAr ? "موثّقة" : "Verified"}
              </Badge>
            )}
            {org.tier && (
              <Badge variant={org.tier === "founding" ? "accent" : "outline"}>
                {org.tier === "founding" ? (isAr ? "مؤسس" : "Founding") : org.tier === "standard" ? (isAr ? "قياسي" : "Standard") : org.tier}
              </Badge>
            )}
            {admin?.isDemo && (
              <Badge variant="outline">
                <FlaskConical aria-hidden className="size-3" />
                {isAr ? "تجريبية" : "Demo"}
              </Badge>
            )}
          </div>
          {otherName && otherName !== name && (
            <p className="mt-0.5 text-sm text-muted-foreground" dir={isAr ? "ltr" : "rtl"}>
              <span className="inline-block">{otherName}</span>
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
            {org.submittedAt ? (
              <span>
                {isAr ? "أُرسل للمراجعة" : "Submitted"} {fmtDate(org.submittedAt, isAr)}
              </span>
            ) : (
              <span>
                {isAr ? "أُنشئ" : "Created"} {fmtDate(org.createdAt, isAr)}
              </span>
            )}
            {waited !== null && (
              <span className={waited >= 7 && status === "SUBMITTED" ? "inline-flex items-center gap-1 font-medium text-destructive" : "inline-flex items-center gap-1"}>
                <Clock aria-hidden className="size-3.5" />
                {waited === 0 ? (isAr ? "اليوم" : "today") : isAr ? `ينتظر منذ ${fmtNumber(waited, true)} يوم` : `waiting ${waited}d`}
              </span>
            )}
            {org.reviewedAt && (
              <span>
                · {isAr ? "رُوجع" : "Reviewed"} {fmtDate(org.reviewedAt, isAr)}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {preSubmit && (
            <Button variant="outline" size="sm" onClick={() => actions.run({ kind: "resend" })} loading={pending === "resend"}>
              <Send aria-hidden />
              {isAr ? "إعادة إرسال الدعوة" : "Resend invitation"}
            </Button>
          )}
          {status === "INVITED" && (
            <Button variant="outline" size="sm" className={destructiveBtn} onClick={() => setDialog("revoke")}>
              <Undo2 aria-hidden />
              {isAr ? "سحب الدعوة" : "Withdraw invitation"}
            </Button>
          )}
          {inReview && (
            <>
              <Button variant="outline" size="sm" onClick={() => setDialog("request-changes")}>
                <MessageSquareWarning aria-hidden />
                {isAr ? "طلب تعديلات" : "Request changes"}
              </Button>
              <Button
                size="sm"
                onClick={() => setDialog("approve")}
                disabled={!canApprove}
                aria-describedby={!canApprove ? "approve-blocked" : undefined}
              >
                <Check aria-hidden />
                {isAr ? "قبول العيادة" : "Approve"}
              </Button>
            </>
          )}
          {(inReview || status === "REGISTERING" || status === "CHANGES_REQUESTED") && (
            <Button variant="outline" size="sm" className={destructiveBtn} onClick={() => setDialog("reject")}>
              <X aria-hidden />
              {isAr ? "رفض" : "Reject"}
            </Button>
          )}
          {status === "APPROVED" && (
            <Button
              size="sm"
              onClick={() => setDialog("go-live")}
              disabled={!canGoLive}
              aria-describedby={!canGoLive ? "golive-blocked" : undefined}
            >
              <Rocket aria-hidden />
              {isAr ? "تفعيل العيادة" : "Go live"}
            </Button>
          )}
          {status === "LIVE" &&
            (org.verified ? (
              <Button variant="outline" size="sm" onClick={() => setDialog("unverify")}>
                <ShieldOff aria-hidden />
                {isAr ? "إزالة التوثيق" : "Unverify"}
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setDialog("verify")}>
                <ShieldCheck aria-hidden />
                {isAr ? "توثيق" : "Verify"}
              </Button>
            ))}
          {(status === "APPROVED" || status === "LIVE") && (
            <Button variant="outline" size="sm" className={destructiveBtn} onClick={() => setDialog("suspend")}>
              <PauseCircle aria-hidden />
              {isAr ? "إيقاف" : "Suspend"}
            </Button>
          )}
          {status === "SUSPENDED" && (
            <Button variant="outline" size="sm" onClick={() => setDialog("unsuspend")}>
              <PlayCircle aria-hidden />
              {isAr ? "إعادة العيادة" : "Reinstate"}
            </Button>
          )}
        </div>
      </div>

      {inReview && !canApprove && (
        <p id="approve-blocked" className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {isAr ? (
            <>
              القبول متاح بعد إنهاء <strong className="text-foreground">{fmtNumber(remaining, true)}</strong> بند:
              {gapCount > 0 && ` ${fmtNumber(gapCount, true)} نقص في التسجيل`}
              {gapCount > 0 && unverifiedRequired > 0 && "،"}
              {unverifiedRequired > 0 && ` ${fmtNumber(unverifiedRequired, true)} مستند مطلوب لم يُتحقق منه`}.
            </>
          ) : (
            <>
              Approve unlocks after <strong className="text-foreground">{remaining}</strong> item{remaining === 1 ? "" : "s"}:
              {gapCount > 0 && ` ${gapCount} registration gap${gapCount === 1 ? "" : "s"}`}
              {gapCount > 0 && unverifiedRequired > 0 && ","}
              {unverifiedRequired > 0 && ` ${unverifiedRequired} required document${unverifiedRequired === 1 ? "" : "s"} to verify`}.
            </>
          )}
        </p>
      )}
      {status === "APPROVED" && !canGoLive && (
        <p id="golive-blocked" className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {isAr
            ? "التفعيل متاح بعد أن تُجري العيادة مسحاً تجريبياً ناجحاً من قائمة التجهيز."
            : "Go live unlocks once the clinic completes a successful test scan from its setup checklist."}
        </p>
      )}

      <ConfirmDialog
        open={dialog === "revoke"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "revoke" }, close)}
        isAr={isAr}
        destructive
        pending={pending === "revoke"}
        title={isAr ? "سحب الدعوة؟" : "Withdraw this invitation?"}
        description={
          isAr
            ? "يتوقف الرابط فوراً ويُغلق هذا السجل كمرفوض. لدعوة العيادة لاحقاً، أنشئ دعوة جديدة."
            : "The link stops working immediately and this record closes as rejected. To invite the clinic later, send a new invitation."
        }
        confirmLabel={isAr ? "سحب الدعوة" : "Withdraw invitation"}
      />

      <ConfirmDialog
        open={dialog === "approve"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "approve" }, close)}
        isAr={isAr}
        pending={pending === "approve"}
        title={isAr ? `قبول ${name}؟` : `Approve ${name}?`}
        description={
          isAr
            ? "تُوثَّق العيادة وتنتقل لمرحلة التجهيز: يصل المالك قائمة التفعيل (تأكيد الفروع، جهاز الاستقبال، مسح تجريبي). لن تظهر للأعضاء حتى تفعّلها."
            : "The clinic is verified and moves to setup: the owner gets the go-live checklist (confirm branches, counter device, test scan). Members won't see it until you switch it live."
        }
        confirmLabel={isAr ? "قبول العيادة" : "Approve clinic"}
      />

      <RequestChangesDialog
        open={dialog === "request-changes"}
        onClose={close}
        onSubmit={(input) => actions.run({ kind: "request-changes", ...input }, close)}
        pending={pending === "request-changes"}
        gaps={state.gaps}
        isAr={isAr}
      />

      <ConfirmDialog
        open={dialog === "reject"}
        onClose={close}
        onConfirm={withReason(5, (reason) => actions.run({ kind: "reject", reason }, close))}
        isAr={isAr}
        destructive
        withReason
        pending={pending === "reject"}
        title={isAr ? "رفض هذا التسجيل؟" : "Reject this registration?"}
        description={
          isAr
            ? "يُغلق التسجيل نهائياً وتُبلَّغ العيادة بالسبب الذي تكتبه. إن كان الإصلاح ممكناً، اطلب تعديلات بدلاً من الرفض."
            : "The registration closes for good and the clinic is told the reason you write. If it can be fixed, request changes instead."
        }
        reasonLabel={isAr ? "سبب الرفض (مطلوب)" : "Reason for rejection (required)"}
        reasonPlaceholder={isAr ? "مثال: الترخيص البيطري موقوف لدى الوزارة" : "e.g. The veterinary licence is suspended by MEWA"}
        confirmLabel={isAr ? "رفض التسجيل" : "Reject registration"}
      />

      <ConfirmDialog
        open={dialog === "go-live"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "go-live" }, close)}
        isAr={isAr}
        pending={pending === "go-live"}
        title={isAr ? `تفعيل ${name}؟` : `Switch ${name} live?`}
        description={
          isAr
            ? "تظهر فروع العيادة في دليل العيادات، ويستطيع فريقها فتح سجلات الأعضاء ضمن الأذونات."
            : "The clinic's branches appear in the directory, and its team can open member records within their granted access."
        }
        confirmLabel={isAr ? "تفعيل الآن" : "Go live now"}
      />

      <ConfirmDialog
        open={dialog === "verify"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "verify" }, close)}
        isAr={isAr}
        pending={pending === "verify"}
        title={isAr ? "توثيق العيادة؟" : "Verify this clinic?"}
        description={
          isAr
            ? "تظهر شارة «موثّقة» للعيادة في الدليل. وثّق فقط بعد التأكد من سريان السجل والتراخيص."
            : "The clinic shows a “Verified” badge in the directory. Only verify after confirming the CR and licences are valid."
        }
        confirmLabel={isAr ? "توثيق" : "Verify"}
      />

      <ConfirmDialog
        open={dialog === "unverify"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "unverify" }, close)}
        isAr={isAr}
        destructive
        pending={pending === "unverify"}
        title={isAr ? "إزالة التوثيق؟" : "Remove verification?"}
        description={
          isAr
            ? "تختفي شارة «موثّقة» ولا تظهر العيادة في الدليل حتى يُعاد توثيقها. يبقى وصول الفريق كما هو."
            : "The “Verified” badge is removed and the clinic leaves the directory until re-verified. Team access is unchanged."
        }
        confirmLabel={isAr ? "إزالة التوثيق" : "Remove verification"}
      />

      <ConfirmDialog
        open={dialog === "suspend"}
        onClose={close}
        onConfirm={withReason(4, (reason) => actions.run({ kind: "suspend", reason }, close))}
        isAr={isAr}
        destructive
        withReason
        pending={pending === "suspend"}
        title={isAr ? `إيقاف ${name}؟` : `Suspend ${name}?`}
        description={
          isAr
            ? "يفقد فريق العيادة الوصول فوراً، وتخرج من الدليل، وتنتهي كل جلسات جهاز الاستقبال. السجلات الطبية تبقى محفوظة."
            : "The clinic's team loses access immediately, it leaves the directory, and every counter session ends. Medical records are preserved."
        }
        reasonLabel={isAr ? "سبب الإيقاف (مطلوب)" : "Reason for suspension (required)"}
        reasonPlaceholder={isAr ? "مثال: انتهاء ترخيص وزارة البيئة" : "e.g. The MEWA licence has expired"}
        confirmLabel={isAr ? "إيقاف العيادة" : "Suspend clinic"}
      />

      <ConfirmDialog
        open={dialog === "unsuspend"}
        onClose={close}
        onConfirm={() => actions.run({ kind: "unsuspend" }, close)}
        isAr={isAr}
        pending={pending === "unsuspend"}
        title={isAr ? "إعادة العيادة؟" : "Reinstate this clinic?"}
        description={
          isAr
            ? "يرفع الإيقاف وتعود العيادة لمرحلة «مقبولة — تجهيز». التفعيل خطوة ثانية منفصلة."
            : "The suspension lifts and the clinic returns to “Approved — setting up”. Going live again is a separate step."
        }
        confirmLabel={isAr ? "إعادة العيادة" : "Reinstate"}
      />
    </div>
  );
}
