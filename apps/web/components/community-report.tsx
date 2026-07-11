"use client";

import * as React from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { Button, Dialog, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";

/**
 * Quiet trust & safety affordance for public cat profiles (the permission slip
 * that lets the community feel safe — trust precedes belonging). One button +
 * dialog shared by the browse cards and the profile page so reporting behaves
 * identically everywhere. The endpoint is authenticated: guests are routed to
 * sign in with a return path, exactly like the like button (honest, no fakes).
 */

const REASONS = [
  { key: "INAPPROPRIATE", ar: "محتوى غير لائق", en: "Inappropriate content" },
  { key: "SPAM", ar: "إعلانات أو محتوى مزعج", en: "Spam or advertising" },
  { key: "FAKE", ar: "ملف غير حقيقي", en: "Fake profile" },
  { key: "HARASSMENT", ar: "تحرّش أو إساءة", en: "Harassment or abuse" },
  { key: "OTHER", ar: "شيء آخر", en: "Something else" },
] as const;

const DETAIL_MAX = 500;

export function ReportCatButton({
  slug,
  name,
  isAr,
  className,
}: {
  slug: string;
  name: string;
  isAr: boolean;
  className?: string;
}) {
  const { user, authedFetch } = useAuth();
  const { toast } = useToast();
  const groupName = React.useId();

  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState<string>("");
  const [detail, setDetail] = React.useState("");
  const [sending, setSending] = React.useState(false);

  const label = isAr ? `الإبلاغ عن ملف ${name}` : `Report ${name}'s profile`;

  function onTriggerClick(e: React.MouseEvent) {
    // Cards live inside a <Link>; a report tap must never navigate.
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      // Honest guest path — same pattern as likes: sign in, then come back.
      const next = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?next=${next}`;
      return;
    }
    setOpen(true);
  }

  function close() {
    if (sending) return;
    setOpen(false);
  }

  async function submit() {
    if (!reason || sending) return;
    setSending(true);
    try {
      await authedFetch(`/community/cats/${slug}/report`, {
        method: "POST",
        body: JSON.stringify({ reason, detail: detail.trim() || undefined }),
      });
      setOpen(false);
      setReason("");
      setDetail("");
      toast({
        title: isAr
          ? "شكراً — بلاغك يساعدنا نحافظ على مجتمع آمن"
          : "Thanks — your report helps keep the community safe",
        variant: "success",
      });
    } catch {
      // R112/R113: what happened + exactly what to do next; never blame the member.
      toast({
        title: isAr ? "ما وصلنا بلاغك" : "Your report didn't go through",
        description: isAr
          ? "جرّب مرة ثانية بعد لحظات — وإذا تكررت المشكلة تواصل مع الدعم."
          : "Please try again in a moment — if it keeps happening, contact support.",
        variant: "error",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onTriggerClick}
        aria-label={label}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground",
          className
        )}
      >
        <Flag className="size-4" aria-hidden />
      </button>

      <Dialog
        open={open}
        onClose={close}
        title={label}
        description={
          isAr
            ? "بلاغك يوصل لفريق مرقط بسرّية — صاحب الملف ما يشوفه."
            : "Your report goes privately to the Moracat team — the profile owner won't see it."
        }
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={sending}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={submit} disabled={!reason} loading={sending}>
              {sending
                ? isAr
                  ? "نرسل بلاغك…"
                  : "Sending your report…"
                : isAr
                  ? "أبلغ عن الملف"
                  : "Report this profile"}
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="sr-only">{isAr ? "سبب البلاغ" : "Reason for the report"}</legend>
          <div className="space-y-0.5">
            {REASONS.map((r) => (
              <label
                key={r.key}
                className={cn(
                  "flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl px-2 text-sm transition-colors",
                  reason === r.key ? "bg-primary/10 text-foreground" : "hover:bg-muted"
                )}
              >
                <input
                  type="radio"
                  name={groupName}
                  value={r.key}
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className="size-4 shrink-0"
                />
                <span>{isAr ? r.ar : r.en}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium" htmlFor={`${groupName}-detail`}>
            {isAr ? "تفاصيل إضافية (اختياري)" : "More detail (optional)"}
          </label>
          <textarea
            id={`${groupName}-detail`}
            value={detail}
            onChange={(e) => setDetail(e.target.value.slice(0, DETAIL_MAX))}
            rows={3}
            maxLength={DETAIL_MAX}
            placeholder={isAr ? "وش اللي شفته؟" : "What did you see?"}
            className="w-full resize-none rounded-xl border border-border bg-card p-2.5 text-sm outline-none ring-primary/20 transition focus:ring-2"
          />
        </div>

        <p className="mt-2 text-xs text-muted-foreground">
          {isAr ? "غير متأكد؟ اقرأ " : "Not sure? Read the "}
          <Link
            href="/legal/community-guidelines"
            className="underline underline-offset-2 hover:text-foreground"
          >
            {isAr ? "إرشادات المجتمع" : "community guidelines"}
          </Link>
          .
        </p>
      </Dialog>
    </>
  );
}
