"use client";

/**
 * Step 6 — look over everything, read the words, sign. The submit button is
 * never a dead end: while anything is missing, the list of exactly what and
 * where sits right above it, each item one tap from its step (R084).
 */

import * as React from "react";
import { ArrowRight, Languages, Send } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import {
  REGISTRATION_STEPS,
  VET_PARTNER_AGREEMENT,
  VET_PARTNER_TERMS_VERSION,
  VET_PDPL_ADDENDUM,
  type RegistrationGap,
  type TermsDocument,
} from "@moraqat/core";
import { registrationError, type RegFriendlyError } from "@/lib/vet-registration";
import { useAuth } from "@/lib/auth";
import { CheckRow, ErrorNote, Notice, StepHeader, TextField, focusFirstError } from "./ui";
import { FullSummary } from "./summary";
import { clearAllDrafts, draftKey, useDraft } from "./use-draft";
import type { StepProps, WizardStep } from "./types";

interface SignForm {
  name: string;
  title: string;
}

export function StepTerms({ orgId, state, api, isAr, onState, onBack, goTo }: StepProps) {
  const { user } = useAuth();
  const meta = REGISTRATION_STEPS.find((s) => s.key === "terms")!;
  const ownerName =
    state.terms.accepted?.signedByName ??
    state.owner?.name ??
    [user?.firstName, user?.lastName].filter(Boolean).join(" ");
  const draft = useDraft<SignForm>(draftKey(orgId, "terms"), () => ({
    name: ownerName ?? "",
    title: state.terms.accepted?.signedByTitle ?? "",
  }));
  const [accepted, setAccepted] = React.useState(false);
  const [attempted, setAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const [serverGaps, setServerGaps] = React.useState<RegistrationGap[] | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const gaps = serverGaps ?? state.gaps;
  const resubmitting = state.org.status === "CHANGES_REQUESTED";
  const errors = {
    name:
      attempted && draft.value.name.trim().length < 3
        ? isAr
          ? "اكتب اسمك الكامل كما في الهوية."
          : "Enter your full name as on your ID."
        : undefined,
    title:
      attempted && draft.value.title.trim().length < 2
        ? isAr
          ? "اكتب صفتك في العيادة، مثل: المالك أو المدير العام."
          : "Enter your role at the clinic, e.g. Owner or General Manager."
        : undefined,
    accept: attempted && !accepted,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    if (gaps.length) return;
    if (draft.value.name.trim().length < 3 || draft.value.title.trim().length < 2 || !accepted) {
      focusFirstError(formRef.current);
      return;
    }
    setBusy(true);
    try {
      const next = await api.submit(orgId, {
        acceptTerms: true,
        termsVersion: VET_PARTNER_TERMS_VERSION,
        signedByName: draft.value.name.trim(),
        signedByTitle: draft.value.title.trim(),
      });
      clearAllDrafts(orgId);
      onState(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const friendly = registrationError(err, isAr);
      if (friendly.gaps?.length) setServerGaps(friendly.gaps);
      setError(friendly);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-6">
      <StepHeader title={isAr ? meta.ar : meta.en} hint={isAr ? meta.hintAr : meta.hintEn} />

      <FullSummary state={state} isAr={isAr} api={api} orgId={orgId} onEdit={goTo} />

      {gaps.length > 0 ? (
        <GapList gaps={gaps} isAr={isAr} editable={state.editableSteps} goTo={goTo} />
      ) : (
        <Notice tone="success" title={isAr ? "كل البيانات مكتملة" : "Everything's in place"}>
          {isAr ? "بقي أن تقرأ الاتفاقية وتوقّع." : "All that's left is to read the agreement and sign."}
        </Notice>
      )}

      <TermsReader isAr={isAr} />

      <Card className="flex flex-col gap-4 p-4 sm:p-6">
        <h3 className="font-display text-base font-semibold">{isAr ? "التوقيع" : "Signature"}</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            isAr={isAr}
            label={isAr ? "الاسم الكامل للموقّع" : "Signatory's full name"}
            value={draft.value.name}
            onChange={(v) => draft.set((p) => ({ ...p, name: v }))}
            error={errors.name}
            required
            autoComplete="name"
            maxLength={120}
          />
          <TextField
            isAr={isAr}
            label={isAr ? "الصفة" : "Job title"}
            hint={isAr ? "مثل: المالك، المدير العام." : "e.g. Owner, General Manager."}
            value={draft.value.title}
            onChange={(v) => draft.set((p) => ({ ...p, title: v }))}
            error={errors.title}
            required
            autoComplete="organization-title"
            maxLength={120}
          />
        </div>
        <div data-invalid={errors.accept ? true : undefined} tabIndex={-1} className="outline-none">
          <CheckRow checked={accepted} onChange={setAccepted} className={cn(errors.accept && "border-destructive/60")}>
            {isAr
              ? `أقرّ بأنني مفوّض بإلزام هذه العيادة، وأوافق على اتفاقية الشراكة وملحق حماية البيانات الشخصية (الإصدار ${VET_PARTNER_TERMS_VERSION}).`
              : `I am authorised to bind this clinic and I accept the Partner Agreement and the Data Protection Addendum (version ${VET_PARTNER_TERMS_VERSION}).`}
          </CheckRow>
          {errors.accept && (
            <p className="mt-1.5 text-xs text-destructive">
              {isAr ? "ضع علامة الموافقة للإرسال." : "Tick the box to submit."}
            </p>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "نحفظ مع توقيعك نسخة النص وتاريخ الموافقة، ليكون واضحاً دائماً ما الذي وافقت عليه بالضبط."
            : "We store the text version and the time with your signature, so it's always clear exactly what was agreed."}
        </p>
      </Card>

      {error && !error.gaps?.length && <ErrorNote error={error} />}

      <div className="h-24 sm:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur pb-safe-6 sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        {gaps.length > 0 && (
          <p className="mb-2 text-center text-xs text-muted-foreground sm:text-start">
            {isAr ? `أكمل ${gaps.length} من البنود أعلاه لتتمكن من الإرسال.` : `Complete the ${gaps.length} item${gaps.length === 1 ? "" : "s"} above to submit.`}
          </p>
        )}
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {onBack && (
            <Button type="button" variant="outline" size="lg" onClick={onBack} className="shrink-0 px-5">
              <ArrowRight className="size-4 ltr:rotate-180" aria-hidden />
              {isAr ? "رجوع" : "Back"}
            </Button>
          )}
          <Button type="submit" size="lg" loading={busy} disabled={gaps.length > 0} className="flex-1 sm:ms-auto sm:flex-none sm:px-10">
            {!busy && <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
            {resubmitting ? (isAr ? "أعد إرسال الطلب" : "Resubmit for review") : isAr ? "أرسل الطلب للمراجعة" : "Submit for review"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function GapList({
  gaps,
  isAr,
  editable,
  goTo,
}: {
  gaps: RegistrationGap[];
  isAr: boolean;
  editable: string[];
  goTo: (s: WizardStep) => void;
}) {
  return (
    <Card className="flex flex-col gap-3 border-warning/40 p-4 sm:p-5" role="region" aria-label={isAr ? "ما بقي" : "What's left"}>
      <div>
        <h3 className="font-display text-base font-semibold">{isAr ? "قبل الإرسال" : "Before you submit"}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isAr ? "كل بند يأخذك مباشرة لمكانه." : "Each item takes you straight to where it's fixed."}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5">
        {gaps.map((g, i) => {
          const step = g.step === "account" ? null : (g.step as WizardStep);
          const canGo = step && editable.includes(step);
          const label = REGISTRATION_STEPS.find((s) => s.key === g.step);
          return (
            <li key={`${g.code}-${g.branchId ?? ""}-${i}`}>
              {canGo ? (
                <button
                  type="button"
                  onClick={() => goTo(step)}
                  className="flex min-h-[44px] w-full items-center gap-3 rounded-xl bg-warning/[0.07] px-3 py-2 text-start text-sm transition-colors hover:bg-warning/[0.14] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block">{isAr ? g.ar : g.en}</span>
                    {label && <span className="block text-xs text-muted-foreground">{isAr ? label.ar : label.en}</span>}
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
                </button>
              ) : (
                <p className="rounded-xl bg-muted px-3 py-2 text-sm">{isAr ? g.ar : g.en}</p>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function TermsReader({ isAr }: { isAr: boolean }) {
  const [readAr, setReadAr] = React.useState(isAr);
  React.useEffect(() => setReadAr(isAr), [isAr]);
  const docs: TermsDocument[] = [VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM];

  return (
    <Card className="flex flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-semibold">{isAr ? "الاتفاقية" : "The agreement"}</h3>
          <p className="text-xs text-muted-foreground">
            {isAr ? `الإصدار ${VET_PARTNER_TERMS_VERSION} · النص العربي هو المعتمد.` : `Version ${VET_PARTNER_TERMS_VERSION} · The Arabic text prevails.`}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setReadAr((v) => !v)}>
          <Languages aria-hidden />
          {readAr ? "Read in English" : "اقرأ بالعربية"}
        </Button>
      </div>
      <div
        lang={readAr ? "ar" : "en"}
        dir={readAr ? "rtl" : "ltr"}
        tabIndex={0}
        role="region"
        aria-label={isAr ? "نص الاتفاقية" : "Agreement text"}
        className="max-h-[26rem] overflow-y-auto rounded-xl border border-border bg-muted/30 px-4 py-4 text-sm leading-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6"
      >
        {docs.map((doc) => (
          <article key={doc.key} className="mb-8 last:mb-0">
            <h4 className="mb-3 font-display text-base font-semibold">{readAr ? doc.titleAr : doc.titleEn}</h4>
            {doc.sections.map((s) => (
              <section key={s.id} className="mb-4 last:mb-0">
                <h5 className="mb-1 text-sm font-semibold">{readAr ? s.titleAr : s.titleEn}</h5>
                {(readAr ? s.bodyAr : s.bodyEn).map((p, i) => (
                  <p key={i} className="mb-2 text-muted-foreground last:mb-0">
                    {p}
                  </p>
                ))}
              </section>
            ))}
          </article>
        ))}
      </div>
    </Card>
  );
}
