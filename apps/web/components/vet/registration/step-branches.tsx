"use client";

/**
 * Step 3 — every branch a member can walk into: where it is, when it's open,
 * and the MEWA licence that makes it a lawful veterinary premises. One card
 * per branch; most clinics have one, so the second card is an invitation, not
 * an obligation (R002).
 */

import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import {
  NATIONAL_ADDRESS_CODE_RE,
  REGISTRATION_STEPS,
  SAUDI_CITIES,
  asciiDigits,
  normalizeNationalAddressCode,
  normalizeSaudiMobile,
} from "@moraqat/core";
import {
  registrationError,
  toDateInput,
  type BranchInput,
  type RegFriendlyError,
  type RegistrationState,
} from "@/lib/vet-registration";
import {
  ActionBar,
  ConfirmDialog,
  EMAIL_RE,
  ErrorNote,
  FormSection,
  RestoredDraftNote,
  SelectField,
  StepHeader,
  SwitchRow,
  TextField,
  focusFirstError,
  isPastDate,
} from "./ui";
import { HoursEditor, hoursError, hoursFromWire, type HourRow } from "./hours-editor";
import { LocationPicker, type LocationValue } from "./location-picker";
import { draftKey, useDraft } from "./use-draft";
import type { StepProps } from "./types";

interface BranchForm {
  /** Local identity for React keys — stable across edits, not sent. */
  key: string;
  id?: string;
  nameAr: string;
  nameEn: string;
  cityCode: string;
  district: string;
  addressLine: string;
  nationalAddressCode: string;
  location: LocationValue;
  phone: string;
  email: string;
  emergency24h: boolean;
  hours: HourRow[];
  services: string[];
  licenceNo: string;
  licenceExpiresAt: string;
}

const newKey = () => `b-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function blankBranch(): BranchForm {
  return {
    key: newKey(),
    nameAr: "",
    nameEn: "",
    cityCode: "",
    district: "",
    addressLine: "",
    nationalAddressCode: "",
    location: { lat: "", lng: "", mapsUrl: "" },
    phone: "",
    email: "",
    emergency24h: false,
    hours: hoursFromWire(undefined),
    services: [],
    licenceNo: "",
    licenceExpiresAt: "",
  };
}

function fromState(s: RegistrationState): BranchForm[] {
  if (!s.branches.length) {
    const first = blankBranch();
    // The main branch usually shares the clinic's name — one less thing to type.
    first.nameAr = s.org.nameAr ?? "";
    first.nameEn = s.org.nameEn ?? "";
    first.phone = s.org.contactPhone ?? "";
    return [first];
  }
  return s.branches.map((b) => ({
    key: b.id,
    id: b.id,
    nameAr: b.nameAr ?? "",
    nameEn: b.nameEn && b.nameEn !== b.nameAr ? b.nameEn : "",
    cityCode: b.cityCode ?? "",
    district: b.district ?? "",
    addressLine: b.addressLine ?? "",
    nationalAddressCode: b.nationalAddressCode ?? "",
    location: {
      lat: b.lat == null ? "" : String(b.lat),
      lng: b.lng == null ? "" : String(b.lng),
      mapsUrl: b.mapsUrl ?? "",
    },
    phone: b.phone ?? "",
    email: b.email ?? "",
    emergency24h: b.emergency24h,
    hours: hoursFromWire(b.hours),
    services: b.services ?? [],
    licenceNo: b.licenceNo ?? "",
    licenceExpiresAt: toDateInput(b.licenceExpiresAt),
  }));
}

type BranchErrors = Partial<Record<keyof BranchForm, string>>;

function normalisePhone(raw: string): string | null {
  const mobile = normalizeSaudiMobile(raw);
  if (mobile) return mobile;
  const compact = asciiDigits(raw).replace(/[\s()-]/g, "");
  return /^\+?\d{8,15}$/.test(compact) ? compact : null;
}

function validateBranch(b: BranchForm, isAr: boolean): BranchErrors {
  const e: BranchErrors = {};
  const t = (ar: string, en: string) => (isAr ? ar : en);
  if (b.nameAr.trim().length < 2) e.nameAr = t("اكتب اسم الفرع بالعربية.", "Enter the branch name in Arabic.");
  if (!b.cityCode) e.cityCode = t("اختر المدينة.", "Choose the city.");
  if (b.district.trim().length < 2) e.district = t("اكتب اسم الحي.", "Enter the district.");
  if (b.addressLine.trim().length < 3) e.addressLine = t("اكتب الشارع والمبنى.", "Enter the street and building.");
  if (b.nationalAddressCode.trim() && !NATIONAL_ADDRESS_CODE_RE.test(normalizeNationalAddressCode(b.nationalAddressCode)))
    e.nationalAddressCode = t("العنوان المختصر ٤ حروف و٤ أرقام، مثل RRRD2929.", "The short address is 4 letters and 4 digits, e.g. RRRD2929.");
  const lat = Number(b.location.lat);
  const lng = Number(b.location.lng);
  if (!b.location.lat.trim() || !b.location.lng.trim() || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    e.location = t("حدّد موقع الفرع — بموقعك الحالي أو برابط الخريطة.", "Set the branch location — with your current location or a map link.");
  if (!normalisePhone(b.phone))
    e.phone = t("اكتب رقم تواصل صحيح، جوال أو هاتف ثابت.", "Enter a valid contact number, mobile or landline.");
  if (b.email.trim() && !EMAIL_RE.test(b.email.trim())) e.email = t("البريد غير صحيح.", "That email doesn't look right.");
  const hErr = hoursError(b.hours, isAr);
  if (hErr) e.hours = hErr;
  if (b.licenceNo.trim().length < 2) e.licenceNo = t("اكتب رقم ترخيص وزارة البيئة.", "Enter the MEWA licence number.");
  if (!b.licenceExpiresAt) e.licenceExpiresAt = t("اختر تاريخ انتهاء الترخيص.", "Choose the licence expiry date.");
  else if (isPastDate(b.licenceExpiresAt))
    e.licenceExpiresAt = t("الترخيص منتهٍ — جدّده قبل الإرسال.", "This licence has expired — renew it before submitting.");
  return e;
}

function toInput(b: BranchForm): BranchInput {
  return {
    ...(b.id ? { id: b.id } : {}),
    nameAr: b.nameAr.trim(),
    nameEn: b.nameEn.trim() || undefined,
    cityCode: b.cityCode,
    district: b.district.trim(),
    addressLine: b.addressLine.trim(),
    nationalAddressCode: b.nationalAddressCode.trim() ? normalizeNationalAddressCode(b.nationalAddressCode) : undefined,
    lat: Number(b.location.lat),
    lng: Number(b.location.lng),
    mapsUrl: b.location.mapsUrl.trim() || undefined,
    phone: normalisePhone(b.phone) ?? b.phone.trim(),
    email: b.email.trim() || undefined,
    hours: b.hours.map((h) => (h.closed ? { day: h.day, closed: true } : { day: h.day, open: h.open, close: h.close })),
    emergency24h: b.emergency24h,
    services: b.services,
    licenceNo: b.licenceNo.trim(),
    licenceExpiresAt: b.licenceExpiresAt,
  };
}

const SERVICE_SUGGESTIONS: { ar: string; en: string }[] = [
  { ar: "تطعيمات", en: "Vaccinations" },
  { ar: "جراحة", en: "Surgery" },
  { ar: "تعقيم", en: "Spay & neuter" },
  { ar: "أسنان", en: "Dental" },
  { ar: "أشعة", en: "X-ray" },
  { ar: "مختبر", en: "Laboratory" },
  { ar: "تنويم", en: "Hospitalisation" },
  { ar: "حلاقة وعناية", en: "Grooming" },
  { ar: "فندقة", en: "Boarding" },
];

export function StepBranches({ orgId, state, api, isAr, onState, onNext, onBack }: StepProps) {
  const draft = useDraft<BranchForm[]>(draftKey(orgId, "branches"), () => fromState(state));
  const branches = draft.value;
  const [attempted, setAttempted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<RegFriendlyError | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<BranchForm | null>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const meta = REGISTRATION_STEPS.find((s) => s.key === "branches")!;

  const update = (key: string, patch: Partial<BranchForm>) =>
    draft.set((prev) => prev.map((b) => (b.key === key ? { ...b, ...patch } : b)));

  function requestRemove(b: BranchForm) {
    // A saved branch may carry an uploaded licence — confirm before it goes.
    if (b.id) setConfirmRemove(b);
    else draft.set((prev) => prev.filter((x) => x.key !== b.key));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setError(null);
    if (branches.some((b) => Object.keys(validateBranch(b, isAr)).length)) {
      focusFirstError(formRef.current);
      return;
    }
    setBusy(true);
    try {
      const next = await api.saveBranches(orgId, branches.map(toInput));
      draft.reset(fromState(next));
      onState(next);
      onNext();
    } catch (err) {
      setError(registrationError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  const removingHasLicence = !!confirmRemove?.id && state.documents.some((d) => d.branchId === confirmRemove.id);

  return (
    <form ref={formRef} onSubmit={save} noValidate className="flex flex-col gap-5">
      <StepHeader title={isAr ? meta.ar : meta.en} hint={isAr ? meta.hintAr : meta.hintEn} />
      {draft.restored && <RestoredDraftNote isAr={isAr} onDiscard={() => draft.reset(fromState(state))} />}

      {branches.map((b, i) => (
        <BranchCard
          key={b.key}
          index={i}
          branch={b}
          isAr={isAr}
          errors={attempted ? validateBranch(b, isAr) : {}}
          canRemove={branches.length > 1}
          onChange={(patch) => update(b.key, patch)}
          onRemove={() => requestRemove(b)}
        />
      ))}

      <button
        type="button"
        onClick={() => draft.set((prev) => [...prev, blankBranch()])}
        className={cn(
          "flex min-h-[56px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 text-sm font-medium text-muted-foreground transition-colors",
          "hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <Plus className="size-4" aria-hidden />
        {isAr ? "أضف فرعاً آخر" : "Add another branch"}
      </button>

      <ErrorNote error={error} />
      <ActionBar
        isAr={isAr}
        onBack={onBack}
        primaryType="submit"
        loading={busy}
        primaryLabel={isAr ? "حفظ ومتابعة" : "Save and continue"}
      />

      <ConfirmDialog
        open={!!confirmRemove}
        isAr={isAr}
        onClose={() => setConfirmRemove(null)}
        onConfirm={() => {
          if (confirmRemove) draft.set((prev) => prev.filter((x) => x.key !== confirmRemove.key));
          setConfirmRemove(null);
        }}
        title={isAr ? "إزالة هذا الفرع؟" : "Remove this branch?"}
        description={
          removingHasLicence
            ? isAr
              ? "ترخيص وزارة البيئة الذي رفعته لهذا الفرع سيُحذف أيضاً عند الحفظ. يمكنك التراجع قبل الضغط على «حفظ ومتابعة» بتجاهل المسودة."
              : "The MEWA licence you uploaded for this branch will also be deleted when you save. Until you press Save, you can undo by discarding the draft."
            : isAr
              ? "يُحذف الفرع عند الحفظ. يمكنك التراجع قبل الضغط على «حفظ ومتابعة» بتجاهل المسودة."
              : "The branch is removed when you save. Until then, you can undo by discarding the draft."
        }
        confirmLabel={isAr ? "إزالة الفرع" : "Remove branch"}
      />
    </form>
  );
}

function BranchCard({
  index,
  branch: b,
  isAr,
  errors,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  branch: BranchForm;
  isAr: boolean;
  errors: BranchErrors;
  canRemove: boolean;
  onChange: (patch: Partial<BranchForm>) => void;
  onRemove: () => void;
}) {
  const cityOptions = SAUDI_CITIES.map((c) => ({ value: c.code, label: isAr ? c.ar : c.en }));
  const heading = isAr ? `الفرع ${index + 1}` : `Branch ${index + 1}`;

  return (
    <Card className="flex flex-col gap-6 p-4 sm:p-6" aria-label={heading}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-base font-semibold">
          {heading}
          {b.nameAr.trim() && <span className="ms-2 font-normal text-muted-foreground">· {b.nameAr}</span>}
        </h3>
        {canRemove && (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-destructive">
            <Trash2 aria-hidden />
            {isAr ? "إزالة" : "Remove"}
          </Button>
        )}
      </div>

      <FormSection title={isAr ? "الاسم والعنوان" : "Name & address"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            isAr={isAr}
            label={isAr ? "اسم الفرع بالعربية" : "Branch name in Arabic"}
            value={b.nameAr}
            onChange={(v) => onChange({ nameAr: v })}
            error={errors.nameAr}
            required
            dir="rtl"
            maxLength={160}
          />
          <TextField
            isAr={isAr}
            label={isAr ? "اسم الفرع بالإنجليزية" : "Branch name in English"}
            value={b.nameEn}
            onChange={(v) => onChange({ nameEn: v })}
            optional
            dir="ltr"
            maxLength={160}
          />
          <SelectField
            isAr={isAr}
            label={isAr ? "المدينة" : "City"}
            value={b.cityCode}
            onChange={(v) => onChange({ cityCode: v })}
            options={cityOptions}
            placeholder={isAr ? "اختر المدينة" : "Choose a city"}
            error={errors.cityCode}
            required
          />
          <TextField
            isAr={isAr}
            label={isAr ? "الحي" : "District"}
            value={b.district}
            onChange={(v) => onChange({ district: v })}
            error={errors.district}
            required
            maxLength={120}
          />
          <TextField
            isAr={isAr}
            className="sm:col-span-2"
            label={isAr ? "الشارع ورقم المبنى" : "Street and building"}
            value={b.addressLine}
            onChange={(v) => onChange({ addressLine: v })}
            error={errors.addressLine}
            required
            maxLength={300}
            autoComplete="street-address"
          />
          <TextField
            isAr={isAr}
            label={isAr ? "العنوان الوطني المختصر" : "National short address"}
            hint={isAr ? "٤ حروف و٤ أرقام، مثل RRRD2929 — من تطبيق «سبل»." : "4 letters + 4 digits, e.g. RRRD2929 — from the SPL app."}
            value={b.nationalAddressCode}
            onChange={(v) => onChange({ nationalAddressCode: v.toUpperCase() })}
            onBlur={() =>
              b.nationalAddressCode && onChange({ nationalAddressCode: normalizeNationalAddressCode(b.nationalAddressCode) })
            }
            error={errors.nationalAddressCode}
            optional
            dir="ltr"
            maxLength={10}
            inputClassName="uppercase tracking-wider"
          />
        </div>
      </FormSection>

      <LocationPicker
        isAr={isAr}
        value={b.location}
        onChange={(location) => onChange({ location })}
        error={errors.location}
      />

      <FormSection title={isAr ? "التواصل" : "Contact"}>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            isAr={isAr}
            type="tel"
            label={isAr ? "رقم التواصل" : "Contact number"}
            hint={isAr ? "جوال أو هاتف ثابت — يظهر للأعضاء." : "Mobile or landline — shown to members."}
            value={b.phone}
            onChange={(v) => onChange({ phone: v })}
            error={errors.phone}
            required
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
          />
          <TextField
            isAr={isAr}
            type="email"
            label={isAr ? "بريد الفرع" : "Branch email"}
            value={b.email}
            onChange={(v) => onChange({ email: v })}
            error={errors.email}
            optional
            dir="ltr"
            inputMode="email"
            maxLength={160}
          />
        </div>
      </FormSection>

      <FormSection title={isAr ? "الخدمة والأوقات" : "Service & hours"}>
        <SwitchRow
          label={isAr ? "طوارئ على مدار الساعة" : "24-hour emergency"}
          description={
            isAr
              ? "فعّلها فقط إذا كان طبيب متاحاً فعلاً في أي وقت — الأعضاء يعتمدون عليها في الحالات الحرجة."
              : "Only if a vet is genuinely available at any hour — members rely on this in an emergency."
          }
          checked={b.emergency24h}
          onChange={(v) => onChange({ emergency24h: v })}
        />
        <HoursEditor isAr={isAr} rows={b.hours} onChange={(hours) => onChange({ hours })} error={errors.hours} />
        <ServicesInput isAr={isAr} value={b.services} onChange={(services) => onChange({ services })} />
      </FormSection>

      <FormSection
        title={isAr ? "ترخيص وزارة البيئة والمياه والزراعة" : "MEWA veterinary licence"}
        description={
          isAr ? "ترخيص المنشأة البيطرية لهذا الفرع. سترفع صورته في الخطوة التالية." : "This branch's veterinary premises licence. You'll upload a copy in the next step."
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            isAr={isAr}
            label={isAr ? "رقم الترخيص" : "Licence number"}
            value={b.licenceNo}
            onChange={(v) => onChange({ licenceNo: asciiDigits(v) })}
            error={errors.licenceNo}
            required
            dir="ltr"
            maxLength={60}
            inputClassName="tabular"
          />
          <TextField
            isAr={isAr}
            type="date"
            label={isAr ? "تاريخ انتهاء الترخيص" : "Licence expiry date"}
            value={b.licenceExpiresAt}
            onChange={(v) => onChange({ licenceExpiresAt: v })}
            error={errors.licenceExpiresAt}
            required
            dir="ltr"
          />
        </div>
      </FormSection>
    </Card>
  );
}

function ServicesInput({ value, onChange, isAr }: { value: string[]; onChange: (v: string[]) => void; isAr: boolean }) {
  const id = React.useId();
  const [text, setText] = React.useState("");
  const add = (raw: string) => {
    const s = raw.trim().slice(0, 60);
    if (!s || value.includes(s) || value.length >= 30) return;
    onChange([...value, s]);
  };
  const suggestions = SERVICE_SUGGESTIONS.map((s) => (isAr ? s.ar : s.en)).filter((s) => !value.includes(s));

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="flex items-baseline gap-1.5 text-sm font-medium">
        {isAr ? "الخدمات" : "Services"}
        <span className="text-xs font-normal text-muted-foreground">{isAr ? "(اختياري)" : "(optional)"}</span>
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={isAr ? "الخدمات المضافة" : "Added services"}>
          {value.map((s) => (
            <li key={s} className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pe-1 ps-3 text-xs font-medium text-primary">
              {s}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x !== s))}
                aria-label={isAr ? `إزالة ${s}` : `Remove ${s}`}
                className="grid size-7 place-items-center rounded-full hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          id={id}
          value={text}
          maxLength={60}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(text);
              setText("");
            }
          }}
          placeholder={isAr ? "اكتب خدمة ثم اضغط إضافة" : "Type a service, then Add"}
          className="h-11 min-w-0 flex-1 rounded-xl border border-input bg-background px-4 text-sm shadow-e1 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            add(text);
            setText("");
          }}
          disabled={!text.trim()}
        >
          {isAr ? "إضافة" : "Add"}
        </Button>
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border px-3 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus className="size-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

