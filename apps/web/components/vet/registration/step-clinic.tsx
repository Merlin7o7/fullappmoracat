"use client";

/**
 * Step 2 — the clinic's legal identity, exactly as the Ministry of Commerce
 * printed it. Numbers accept Arabic-Indic digits because that is what a CR
 * certificate photo pasted from WhatsApp gives you (R002 — effort is the enemy).
 */

import * as React from "react";
import { Card } from "@moraqat/ui";
import { CR_NUMBER_RE, REGISTRATION_STEPS, UNIFIED_NUMBER_RE, VAT_NUMBER_RE, asciiDigits } from "@moraqat/core";
import { registrationError, toDateInput, type RegFriendlyError, type RegistrationState } from "@/lib/vet-registration";
import { ActionBar, ErrorNote, FormSection, RestoredDraftNote, StepHeader, TextField, focusFirstError, isPastDate } from "./ui";
import { draftKey, useDraft } from "./use-draft";
import type { StepProps } from "./types";

interface ClinicForm {
  nameAr: string;
  nameEn: string;
  legalNameAr: string;
  legalNameEn: string;
  crNumber: string;
  unifiedNumber: string;
  crExpiresAt: string;
  vatNumber: string;
}

function fromState(s: RegistrationState): ClinicForm {
  return {
    nameAr: s.org.nameAr ?? "",
    nameEn: s.org.nameEn ?? "",
    legalNameAr: s.org.legalNameAr ?? "",
    legalNameEn: s.org.legalNameEn ?? "",
    crNumber: s.org.crNumber ?? "",
    unifiedNumber: s.org.unifiedNumber ?? "",
    crExpiresAt: toDateInput(s.org.crExpiresAt),
    vatNumber: s.org.vatNumber ?? "",
  };
}

const digitsOnly = (v: string) => asciiDigits(v).replace(/\s+/g, "");

type Errors = Partial<Record<keyof ClinicForm, string>>;

function validate(f: ClinicForm, isAr: boolean): Errors {
  const e: Errors = {};
  const t = (ar: string, en: string) => (isAr ? ar : en);
  if (f.nameAr.trim().length < 2) e.nameAr = t("اكتب اسم العيادة بالعربية.", "Enter the clinic name in Arabic.");
  if (f.nameEn.trim().length < 2) e.nameEn = t("اكتب اسم العيادة بالإنجليزية.", "Enter the clinic name in English.");
  if (f.legalNameAr.trim().length < 2)
    e.legalNameAr = t("اكتب الاسم كما يظهر في السجل التجاري.", "Enter the name exactly as it appears on the CR.");
  if (!CR_NUMBER_RE.test(digitsOnly(f.crNumber)))
    e.crNumber = t("رقم السجل التجاري ١٠ أرقام.", "The CR number is 10 digits.");
  if (!UNIFIED_NUMBER_RE.test(digitsOnly(f.unifiedNumber)))
    e.unifiedNumber = t("الرقم الوطني الموحد ١٠ أرقام ويبدأ بـ ٧.", "The unified number is 10 digits and starts with 7.");
  if (!f.crExpiresAt) e.crExpiresAt = t("اختر تاريخ انتهاء السجل.", "Choose the CR expiry date.");
  else if (isPastDate(f.crExpiresAt))
    e.crExpiresAt = t("هذا السجل منتهٍ — جدّده أولاً ثم أكمل التسجيل.", "This CR has expired — renew it first, then continue.");
  if (f.vatNumber.trim() && !VAT_NUMBER_RE.test(digitsOnly(f.vatNumber)))
    e.vatNumber = t("الرقم الضريبي ١٥ رقماً، يبدأ وينتهي بـ ٣.", "A VAT number is 15 digits, starting and ending with 3.");
  return e;
}

export function StepClinic({ orgId, state, api, isAr, onState, onNext, onBack }: StepProps) {
  const draft = useDraft<ClinicForm>(draftKey(orgId, "clinic"), () => fromState(state));
  const f = draft.value;
  const [attempted, setAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const meta = REGISTRATION_STEPS.find((s) => s.key === "clinic")!;

  const errors = attempted ? validate(f, isAr) : {};
  const update = (patch: Partial<ClinicForm>) => draft.set((prev) => ({ ...prev, ...patch }));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setAttempted(true);
    setError(null);
    if (Object.keys(validate(f, isAr)).length) {
      focusFirstError(formRef.current);
      return;
    }
    setBusy(true);
    try {
      const next = await api.saveClinic(orgId, {
        nameAr: f.nameAr.trim(),
        nameEn: f.nameEn.trim(),
        legalNameAr: f.legalNameAr.trim(),
        legalNameEn: f.legalNameEn.trim() || undefined,
        crNumber: digitsOnly(f.crNumber),
        unifiedNumber: digitsOnly(f.unifiedNumber),
        crExpiresAt: f.crExpiresAt,
        vatNumber: f.vatNumber.trim() ? digitsOnly(f.vatNumber) : undefined,
      });
      draft.reset(fromState(next));
      onState(next);
      onNext();
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-5">
      <StepHeader title={isAr ? meta.ar : meta.en} hint={isAr ? meta.hintAr : meta.hintEn} />
      {draft.restored && <RestoredDraftNote isAr={isAr} onDiscard={() => draft.reset(fromState(state))} />}

      <Card className="flex flex-col gap-6 p-4 sm:p-6">
        <FormSection
          title={isAr ? "اسم العيادة" : "Clinic name"}
          description={isAr ? "الاسم الذي يراه الأعضاء في دليل العيادات." : "The name members see in the clinic directory."}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              isAr={isAr}
              label={isAr ? "الاسم بالعربية" : "Name in Arabic"}
              value={f.nameAr}
              onChange={(v) => update({ nameAr: v })}
              error={errors.nameAr}
              required
              dir="rtl"
              maxLength={160}
              autoComplete="organization"
            />
            <TextField
              isAr={isAr}
              label={isAr ? "الاسم بالإنجليزية" : "Name in English"}
              value={f.nameEn}
              onChange={(v) => update({ nameEn: v })}
              error={errors.nameEn}
              required
              dir="ltr"
              maxLength={160}
            />
          </div>
        </FormSection>

        <FormSection
          title={isAr ? "البيانات النظامية" : "Legal details"}
          description={
            isAr
              ? "انسخها من شهادة السجل التجاري حرفياً — المراجِع يطابقها مع الشهادة التي سترفعها."
              : "Copy these from the CR certificate word for word — the reviewer matches them against the certificate you upload."
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              isAr={isAr}
              label={isAr ? "الاسم النظامي بالعربية" : "Legal name in Arabic"}
              hint={isAr ? "تماماً كما في السجل التجاري." : "Exactly as on the CR."}
              value={f.legalNameAr}
              onChange={(v) => update({ legalNameAr: v })}
              error={errors.legalNameAr}
              required
              dir="rtl"
              maxLength={200}
            />
            <TextField
              isAr={isAr}
              label={isAr ? "الاسم النظامي بالإنجليزية" : "Legal name in English"}
              value={f.legalNameEn}
              onChange={(v) => update({ legalNameEn: v })}
              optional
              dir="ltr"
              maxLength={200}
            />
            <TextField
              isAr={isAr}
              label={isAr ? "رقم السجل التجاري" : "Commercial registration (CR) number"}
              hint={isAr ? "١٠ أرقام — مثل 1010123456" : "10 digits — e.g. 1010123456"}
              value={f.crNumber}
              onChange={(v) => update({ crNumber: v })}
              onBlur={() => f.crNumber && update({ crNumber: digitsOnly(f.crNumber) })}
              error={errors.crNumber}
              required
              dir="ltr"
              inputMode="numeric"
              maxLength={14}
              inputClassName="tabular tracking-wide"
            />
            <TextField
              isAr={isAr}
              label={isAr ? "الرقم الوطني الموحد" : "Unified national number"}
              hint={isAr ? "١٠ أرقام تبدأ بـ ٧ — مكتوب أعلى السجل." : "10 digits starting with 7 — printed at the top of the CR."}
              value={f.unifiedNumber}
              onChange={(v) => update({ unifiedNumber: v })}
              onBlur={() => f.unifiedNumber && update({ unifiedNumber: digitsOnly(f.unifiedNumber) })}
              error={errors.unifiedNumber}
              required
              dir="ltr"
              inputMode="numeric"
              maxLength={14}
              inputClassName="tabular tracking-wide"
            />
            <TextField
              isAr={isAr}
              type="date"
              label={isAr ? "تاريخ انتهاء السجل" : "CR expiry date"}
              hint={isAr ? "بالتاريخ الميلادي." : "Gregorian date."}
              value={f.crExpiresAt}
              onChange={(v) => update({ crExpiresAt: v })}
              error={errors.crExpiresAt}
              required
              dir="ltr"
            />
            <TextField
              isAr={isAr}
              label={isAr ? "الرقم الضريبي" : "VAT registration number"}
              hint={isAr ? "إن كانت العيادة مسجّلة في ضريبة القيمة المضافة — ١٥ رقماً." : "If the clinic is VAT-registered — 15 digits."}
              value={f.vatNumber}
              onChange={(v) => update({ vatNumber: v })}
              onBlur={() => f.vatNumber && update({ vatNumber: digitsOnly(f.vatNumber) })}
              error={errors.vatNumber}
              optional
              dir="ltr"
              inputMode="numeric"
              maxLength={20}
              inputClassName="tabular tracking-wide"
            />
          </div>
        </FormSection>
      </Card>

      <ErrorNote error={error} />
      <ActionBar
        isAr={isAr}
        onBack={onBack}
        primaryType="submit"
        loading={busy}
        primaryLabel={isAr ? "حفظ ومتابعة" : "Save and continue"}
      />
    </form>
  );
}
