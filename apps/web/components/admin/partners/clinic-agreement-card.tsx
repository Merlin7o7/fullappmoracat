"use client";

/**
 * The evidence of acceptance (who signed which version of which words, from
 * where) and the go-live checklist. The content hash names the exact text the
 * signer saw — shown truncated, copyable in full.
 */

import * as React from "react";
import { FileSignature, Copy, Check, Rocket, CircleDashed, CheckCircle2 } from "lucide-react";
import { Badge, useToast } from "@moraqat/ui";
import type { RegistrationState } from "@/lib/vet-registration";
import { fmtDateTime } from "@/app/admin/_components/i18n";
import { KV, SectionCard } from "./shared";

export function ClinicAgreementCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const a = state.admin?.agreement ?? null;
  const current = state.terms.currentVersion;
  const outdated = !!a?.termsVersion && a.termsVersion !== current;

  const copyHash = async () => {
    if (!a?.contentHash) return;
    try {
      await navigator.clipboard.writeText(a.contentHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: isAr ? "تعذّر النسخ" : "Couldn't copy",
        description: isAr ? "حدّد البصمة وانسخها يدوياً." : "Select the hash and copy it manually.",
        variant: "error",
      });
    }
  };

  return (
    <SectionCard
      icon={FileSignature}
      title={isAr ? "اتفاقية الشراكة" : "Partner agreement"}
      action={
        a ? (
          outdated ? (
            <Badge variant="warning">{isAr ? "نسخة أقدم" : "Older version"}</Badge>
          ) : (
            <Badge variant="success">{isAr ? "موقّعة" : "Signed"}</Badge>
          )
        ) : (
          <Badge variant="secondary">{isAr ? "لم تُوقّع" : "Not signed"}</Badge>
        )
      }
    >
      {!a ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {isAr ? "يوقّع المالك الاتفاقية عند إرسال التسجيل." : "The owner signs the agreement when submitting the registration."}
        </p>
      ) : (
        <dl>
          <KV label={isAr ? "نسخة الشروط" : "Terms version"} ltr mono>
            {a.termsVersion}
          </KV>
          <KV label={isAr ? "وقّع باسم" : "Signed by"}>{a.signedByName}</KV>
          <KV label={isAr ? "الصفة" : "Title"}>{a.signedByTitle}</KV>
          <KV label={isAr ? "وقت التوقيع" : "Signed at"}>{a.signedAt ? fmtDateTime(a.signedAt, isAr) : null}</KV>
          <KV label={isAr ? "عنوان IP" : "IP address"} ltr mono>
            {a.ipAddress}
          </KV>
          <KV label={isAr ? "بصمة النص" : "Content hash"}>
            {a.contentHash ? (
              <span className="inline-flex items-center gap-1">
                <code className="font-mono text-xs" dir="ltr" title={a.contentHash}>
                  {a.contentHash.slice(0, 12)}…{a.contentHash.slice(-6)}
                </code>
                <button
                  type="button"
                  onClick={() => void copyHash()}
                  aria-label={isAr ? "نسخ البصمة كاملة" : "Copy full hash"}
                  className="inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {copied ? <Check aria-hidden className="size-4 text-success" /> : <Copy aria-hidden className="size-4" />}
                </button>
                <span className="sr-only" aria-live="polite">
                  {copied ? (isAr ? "نُسخت" : "Copied") : ""}
                </span>
              </span>
            ) : null}
          </KV>
        </dl>
      )}
    </SectionCard>
  );
}

export function GoLiveChecklistCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const c = state.admin?.checklist;
  if (!c) return null;
  const items: { key: string; ar: string; en: string; at: string | null; required: boolean }[] = [
    { key: "branches", ar: "تأكيد بيانات الفروع", en: "Branch details confirmed", at: c.branchesConfirmedAt, required: true },
    { key: "testScan", ar: "مسح تجريبي ناجح", en: "Successful test scan", at: c.testScanAt, required: true },
    { key: "request", ar: "طلبت العيادة التفعيل", en: "Clinic requested go-live", at: c.goLiveRequestedAt, required: false },
  ];

  return (
    <SectionCard icon={Rocket} title={isAr ? "قائمة التفعيل" : "Go-live checklist"}>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.key} className="flex min-h-[44px] items-center justify-between gap-3 border-b border-border py-1.5 last:border-0">
            <span className="flex items-center gap-2 text-sm">
              {it.at ? (
                <CheckCircle2 aria-hidden className="size-4 text-success" />
              ) : (
                <CircleDashed aria-hidden className="size-4 text-muted-foreground" />
              )}
              {isAr ? it.ar : it.en}
              {!it.required && <span className="text-xs text-muted-foreground">{isAr ? "(اختياري)" : "(optional)"}</span>}
            </span>
            <span className="text-xs text-muted-foreground">
              {it.at ? fmtDateTime(it.at, isAr) : isAr ? "لم يكتمل" : "Not done"}
            </span>
          </li>
        ))}
      </ul>
      {state.admin?.isDemo && !c.testScanAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          {isAr ? "عيادة تجريبية — يمكن تفعيلها بدون مسح تجريبي." : "Demo clinic — can go live without a test scan."}
        </p>
      )}
    </SectionCard>
  );
}
