"use client";

// ════════════════════════════════════════════════════════════════════════
//  EntryComposer — one composer, fourteen typed clinical entries
//  (MRC-VET-001 §10 "Medical records").
//
//  Why one component and not fourteen forms: a vet mid-consult should learn
//  ONE interaction and have it hold for a vaccination, a lab result and a
//  surgery. The type switch changes the FIELDS, never the grammar — the same
//  save button, the same validation voice, the same autosave-safe draft.
//
//  Three things this file exists to guarantee:
//    • A prescription is BLOCKED, not warned, when the drug matches a
//      recorded allergy. §10: "allergy interaction check … fires a blocking
//      warning". Overriding demands a typed clinical justification that is
//      stored on the record — an override with a name on it, not a shrug.
//    • An INTERN's authorship saves as DRAFT and says so before they type,
//      not after they save (§14, prevent > apologise, R115).
//    • Nothing is ever lost. A failed save leaves every entered value
//      untouched (R117).
//
//  Transport note: `VetTimelineKind` is the API's storage-level entry kind
//  (ten values). Clinicians think in more categories than that — a diagnosis
//  is not a note, a surgery is not an exam — so the composer works in the
//  richer clinical vocabulary below and maps down to the transport kind on
//  save, carrying the clinical subtype in the payload. The record keeps both:
//  what the system stores, and what the clinician meant.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { AlertOctagon, Check, Info } from "lucide-react";
import { Button, Input, Badge, cn, useToast } from "@moraqat/ui";
import { requiresCoSign } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { VET_ENTRY_KIND_LABELS } from "@/lib/vet-wire";
import {
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type EntryType,
  type MedicalAlert,
} from "@/lib/vet-api";

// ── the clinical vocabulary ──────────────────────────────────────────────

export type ClinicalEntryType =
  | "EXAM"
  | "DIAGNOSIS"
  | "VACCINATION"
  | "TREATMENT"
  | "PRESCRIPTION"
  | "LAB"
  | "IMAGING"
  | "SURGERY"
  | "DENTAL"
  | "HOSPITALIZATION"
  | "WEIGHT"
  | "NUTRITION"
  | "SUPPLEMENT"
  | "NOTE";

export const ENTRY_TYPES: ClinicalEntryType[] = [
  "EXAM",
  "DIAGNOSIS",
  "VACCINATION",
  "TREATMENT",
  "PRESCRIPTION",
  "LAB",
  "IMAGING",
  "SURGERY",
  "DENTAL",
  "HOSPITALIZATION",
  "WEIGHT",
  "NUTRITION",
  "SUPPLEMENT",
  "NOTE",
];

export const ENTRY_TYPE_LABELS: Record<ClinicalEntryType, { ar: string; en: string }> = {
  EXAM: { ar: "فحص", en: "Examination" },
  DIAGNOSIS: { ar: "تشخيص", en: "Diagnosis" },
  VACCINATION: { ar: "تحصين", en: "Vaccination" },
  TREATMENT: { ar: "علاج", en: "Treatment" },
  PRESCRIPTION: { ar: "وصفة", en: "Prescription" },
  LAB: { ar: "مختبر", en: "Lab" },
  IMAGING: { ar: "أشعة", en: "Imaging" },
  SURGERY: { ar: "جراحة", en: "Surgery" },
  DENTAL: { ar: "أسنان", en: "Dental" },
  HOSPITALIZATION: { ar: "تنويم", en: "Hospitalisation" },
  WEIGHT: { ar: "وزن", en: "Weight" },
  NUTRITION: { ar: "تغذية", en: "Nutrition" },
  SUPPLEMENT: { ar: "مكمّل", en: "Supplement" },
  NOTE: { ar: "ملاحظة", en: "Note" },
};

/** Clinical vocabulary → the API's storage kind. */
/**
 * Clinical type → stored entry type. Now an identity map: every clinical kind
 * the composer offers is stored AS ITSELF. It previously collapsed diagnosis,
 * treatment, surgery, dental, hospitalisation, nutrition and supplement into
 * "NOTE" because the client type modelled only ten kinds — which in an
 * append-only record is permanent, silent data loss (nothing can be edited
 * back later, and a surgery would never again be findable as a surgery).
 * The client type now mirrors the database enum exactly, so the collapse is gone.
 */
export const TRANSPORT_KIND: Record<ClinicalEntryType, EntryType> = {
  EXAM: "EXAM",
  DIAGNOSIS: "DIAGNOSIS",
  VACCINATION: "VACCINATION",
  TREATMENT: "TREATMENT",
  PRESCRIPTION: "PRESCRIPTION",
  LAB: "LAB",
  IMAGING: "IMAGING",
  SURGERY: "SURGERY",
  DENTAL: "DENTAL",
  HOSPITALIZATION: "HOSPITALIZATION",
  WEIGHT: "WEIGHT",
  NUTRITION: "NUTRITION",
  SUPPLEMENT: "SUPPLEMENT",
  NOTE: "NOTE",
};

/** Bilingual label for a stored entry kind, for read surfaces. */
export function entryKindLabel(kind: EntryType, isAr: boolean): string {
  // Single source: the timeline adapter derives entry titles from the same map,
  // so a kind can never be worded one way in the composer and another in the
  // record it produces.
  const e = VET_ENTRY_KIND_LABELS[kind];
  return e ? (isAr ? e.ar : e.en) : kind;
}

// ── field schema ─────────────────────────────────────────────────────────

type FieldKind = "text" | "textarea" | "number" | "date" | "select";

export interface Field {
  name: string;
  ar: string;
  en: string;
  kind: FieldKind;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: number;
  options?: { value: string; ar: string; en: string }[];
  hintAr?: string;
  hintEn?: string;
  /** Half-width on desktop — keeps dense clinical forms scannable. */
  half?: boolean;
}

const ROUTE_OPTIONS = [
  { value: "SC", ar: "تحت الجلد", en: "Subcutaneous" },
  { value: "IM", ar: "عضلي", en: "Intramuscular" },
  { value: "IV", ar: "وريدي", en: "Intravenous" },
  { value: "PO", ar: "فموي", en: "Oral" },
  { value: "TOPICAL", ar: "موضعي", en: "Topical" },
  { value: "INTRANASAL", ar: "أنفي", en: "Intranasal" },
];

const SEVERITY_OPTIONS = [
  { value: "LOW", ar: "منخفض", en: "Low" },
  { value: "MODERATE", ar: "متوسط", en: "Moderate" },
  { value: "HIGH", ar: "مرتفع", en: "High" },
  { value: "CRITICAL", ar: "حرِج", en: "Critical" },
];

/**
 * The structured payload per clinical type. Shapes follow §10's "Entry types"
 * table; EXAM is the SOAP-lite spine the dossier specifies (subjective ·
 * findings · plan) with vitals attached, because that is what a routine
 * consult records.
 */
export const TYPE_FIELDS: Record<ClinicalEntryType, Field[]> = {
  EXAM: [
    { name: "subjective", ar: "الشكوى (ما يرويه المالك)", en: "Subjective — what the owner reports", kind: "textarea", rows: 3 },
    { name: "objective", ar: "الفحص والعلامات", en: "Objective — findings", kind: "textarea", rows: 3 },
    { name: "assessment", ar: "التقييم", en: "Assessment", kind: "textarea", rows: 2 },
    { name: "plan", ar: "الخطة", en: "Plan", kind: "textarea", rows: 2 },
    { name: "weightKg", ar: "الوزن (كجم)", en: "Weight (kg)", kind: "number", min: 0.1, max: 25, step: 0.01, half: true },
    { name: "temperatureC", ar: "الحرارة (°م)", en: "Temperature (°C)", kind: "number", min: 30, max: 45, step: 0.1, half: true },
    { name: "heartRate", ar: "النبض (نبضة/د)", en: "Heart rate (bpm)", kind: "number", min: 40, max: 320, step: 1, half: true },
    { name: "respRate", ar: "التنفس (نفس/د)", en: "Respiratory rate (bpm)", kind: "number", min: 5, max: 120, step: 1, half: true },
  ],
  DIAGNOSIS: [
    { name: "condition", ar: "التشخيص", en: "Condition", kind: "text", required: true },
    { name: "severity", ar: "الشدة", en: "Severity", kind: "select", options: SEVERITY_OPTIONS, required: true, half: true },
    {
      name: "status",
      ar: "الحالة",
      en: "Status",
      kind: "select",
      half: true,
      options: [
        { value: "SUSPECTED", ar: "مشتبه به", en: "Suspected" },
        { value: "CONFIRMED", ar: "مؤكد", en: "Confirmed" },
        { value: "CHRONIC", ar: "مزمن", en: "Chronic" },
        { value: "RESOLVED", ar: "متعافٍ", en: "Resolved" },
      ],
    },
    { name: "basis", ar: "أساس التشخيص", en: "Basis for diagnosis", kind: "textarea", rows: 2 },
  ],
  VACCINATION: [
    { name: "vaccine", ar: "اللقاح", en: "Vaccine", kind: "text", required: true, hintAr: "مثال: سعار، FVRCP", hintEn: "e.g. Rabies, FVRCP" },
    { name: "product", ar: "المنتج التجاري", en: "Product", kind: "text", half: true },
    { name: "batch", ar: "رقم التشغيلة", en: "Batch number", kind: "text", required: true, half: true },
    { name: "route", ar: "طريقة الإعطاء", en: "Route", kind: "select", options: ROUTE_OPTIONS, required: true, half: true },
    { name: "site", ar: "موضع الحقن", en: "Injection site", kind: "text", half: true },
    {
      name: "nextDueAt",
      ar: "موعد الجرعة القادمة",
      en: "Next dose due",
      kind: "date",
      required: true,
      half: true,
      hintAr: "يُرسَل للمالك كتذكير تلقائي",
      hintEn: "Becomes the owner's automatic reminder",
    },
  ],
  TREATMENT: [
    { name: "treatment", ar: "العلاج المُعطى", en: "Treatment given", kind: "text", required: true },
    { name: "dose", ar: "الجرعة", en: "Dose", kind: "text", half: true },
    { name: "route", ar: "الطريقة", en: "Route", kind: "select", options: ROUTE_OPTIONS, half: true },
    { name: "response", ar: "الاستجابة", en: "Response", kind: "textarea", rows: 2 },
  ],
  PRESCRIPTION: [
    { name: "drug", ar: "الدواء", en: "Drug", kind: "text", required: true },
    { name: "dose", ar: "الجرعة", en: "Dose", kind: "text", required: true, half: true },
    { name: "frequency", ar: "التكرار", en: "Frequency", kind: "text", required: true, half: true, hintAr: "مثال: مرتين يومياً", hintEn: "e.g. twice daily" },
    { name: "durationDays", ar: "المدة (أيام)", en: "Duration (days)", kind: "number", min: 1, max: 365, step: 1, required: true, half: true },
    { name: "refills", ar: "عدد التكرارات", en: "Refills", kind: "number", min: 0, max: 12, step: 1, half: true },
    { name: "instructions", ar: "تعليمات للمالك", en: "Owner instructions", kind: "textarea", rows: 2 },
  ],
  LAB: [
    { name: "test", ar: "الفحص", en: "Test", kind: "text", required: true },
    { name: "sample", ar: "العينة", en: "Sample", kind: "text", half: true },
    { name: "lab", ar: "المختبر", en: "Laboratory", kind: "text", half: true },
    { name: "result", ar: "النتيجة", en: "Result", kind: "textarea", rows: 2 },
    { name: "interpretation", ar: "التفسير السريري", en: "Clinical interpretation", kind: "textarea", rows: 2 },
  ],
  IMAGING: [
    {
      name: "modality",
      ar: "نوع التصوير",
      en: "Modality",
      kind: "select",
      required: true,
      half: true,
      options: [
        { value: "XRAY", ar: "أشعة سينية", en: "X-ray" },
        { value: "ULTRASOUND", ar: "موجات صوتية", en: "Ultrasound" },
        { value: "CT", ar: "مقطعية", en: "CT" },
        { value: "MRI", ar: "رنين", en: "MRI" },
      ],
    },
    { name: "region", ar: "المنطقة", en: "Body region", kind: "text", required: true, half: true },
    { name: "findings", ar: "الموجودات", en: "Findings", kind: "textarea", rows: 3 },
  ],
  SURGERY: [
    { name: "procedure", ar: "العملية", en: "Procedure", kind: "text", required: true },
    { name: "anaesthesia", ar: "التخدير", en: "Anaesthesia", kind: "textarea", rows: 2 },
    { name: "complications", ar: "المضاعفات", en: "Complications", kind: "textarea", rows: 2, hintAr: "اكتب «لا يوجد» إذا مرّت بسلام", hintEn: "Write “none” if uneventful" },
    { name: "dischargeInstructions", ar: "تعليمات الخروج", en: "Discharge instructions", kind: "textarea", rows: 3, required: true },
  ],
  DENTAL: [
    { name: "procedure", ar: "الإجراء", en: "Procedure", kind: "text", required: true },
    {
      name: "gradeStage",
      ar: "درجة أمراض اللثة",
      en: "Periodontal grade",
      kind: "select",
      half: true,
      options: [
        { value: "0", ar: "0 — سليم", en: "0 — healthy" },
        { value: "1", ar: "1 — التهاب لثة", en: "1 — gingivitis" },
        { value: "2", ar: "2 — مبكر", en: "2 — early" },
        { value: "3", ar: "3 — متوسط", en: "3 — moderate" },
        { value: "4", ar: "4 — متقدم", en: "4 — advanced" },
      ],
    },
    { name: "extractions", ar: "الأسنان المخلوعة", en: "Teeth extracted", kind: "text", half: true },
    { name: "findings", ar: "الموجودات", en: "Findings", kind: "textarea", rows: 2 },
  ],
  HOSPITALIZATION: [
    { name: "reason", ar: "سبب التنويم", en: "Reason for admission", kind: "text", required: true },
    { name: "admittedAt", ar: "وقت الدخول", en: "Admitted", kind: "date", required: true, half: true },
    { name: "dischargedAt", ar: "وقت الخروج", en: "Discharged", kind: "date", half: true },
    { name: "course", ar: "سير الحالة", en: "Clinical course", kind: "textarea", rows: 3 },
  ],
  WEIGHT: [
    { name: "weightKg", ar: "الوزن (كجم)", en: "Weight (kg)", kind: "number", required: true, min: 0.1, max: 25, step: 0.01, half: true },
    {
      name: "bcs",
      ar: "مؤشر كتلة الجسم (١–٩)",
      en: "Body condition score (1–9)",
      kind: "number",
      min: 1,
      max: 9,
      step: 1,
      half: true,
      hintAr: "٤–٥ مثالي",
      hintEn: "4–5 is ideal",
    },
  ],
  NUTRITION: [
    { name: "diet", ar: "النظام الغذائي", en: "Diet", kind: "text", required: true },
    { name: "gramsPerDay", ar: "الكمية اليومية (جم)", en: "Daily amount (g)", kind: "number", min: 1, max: 1000, step: 1, half: true },
    { name: "mealsPerDay", ar: "عدد الوجبات", en: "Meals per day", kind: "number", min: 1, max: 8, step: 1, half: true },
    { name: "rationale", ar: "السبب السريري", en: "Clinical rationale", kind: "textarea", rows: 2 },
  ],
  SUPPLEMENT: [
    { name: "supplement", ar: "المكمّل", en: "Supplement", kind: "text", required: true },
    { name: "dose", ar: "الجرعة", en: "Dose", kind: "text", half: true },
    { name: "durationDays", ar: "المدة (أيام)", en: "Duration (days)", kind: "number", min: 1, max: 365, step: 1, half: true },
  ],
  NOTE: [
    {
      name: "subtype",
      ar: "نوع الملاحظة",
      en: "Note type",
      kind: "select",
      half: true,
      options: [
        { value: "GENERAL", ar: "عامة", en: "General" },
        { value: "HANDLING", ar: "تعامل وسلوك", en: "Behaviour / handling" },
        { value: "FOLLOW_UP", ar: "متابعة", en: "Follow-up" },
      ],
      hintAr: "«تعامل وسلوك» تظهر ضمن تنبيهات المستوى صفر",
      hintEn: "“Behaviour / handling” surfaces in the tier-0 alerts band",
    },
    { name: "text", ar: "النص", en: "Text", kind: "textarea", rows: 3, required: true },
  ],
};

// ── allergy interaction check ────────────────────────────────────────────

/**
 * Conservative two-way substring match on drug names against the recorded
 * ALLERGY alerts. Deliberately eager: a false positive costs one sentence of
 * justification, a false negative can cost the cat. The copy names the
 * recorded text rather than claiming pharmacology we don't have.
 */
export function matchAllergies(drug: string, alerts: MedicalAlert[]): MedicalAlert[] {
  const q = drug.trim().toLowerCase();
  if (q.length < 3) return [];
  return alerts
    .filter((a) => a.kind === "ALLERGY")
    .filter((a) => {
      const labels = [a.labelEn, a.labelAr].map((l) => (l ?? "").trim().toLowerCase());
      return labels.some((label) => label.length > 0 && (label.includes(q) || q.includes(label)));
    });
}

// ── the composer ─────────────────────────────────────────────────────────

export interface EntryComposerProps {
  catId: string;
  visitId?: string;
  /** The patient's alerts — powers the blocking prescription check. */
  alerts?: MedicalAlert[];
  /** Lock the composer to one type (amendments keep the original type). */
  lockedType?: ClinicalEntryType;
  /** Amend mode targets an existing entry and creates revision n+1. */
  amendOf?: { entryId: string; type: ClinicalEntryType; note?: string };
  onSaved: (result: { id: string; isDraft: boolean }) => void;
  onCancel?: () => void;
  className?: string;
}

export function EntryComposer({
  catId,
  visitId,
  alerts = [],
  lockedType,
  amendOf,
  onSaved,
  onCancel,
  className,
}: EntryComposerProps) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const isAmend = !!amendOf;

  const [type, setType] = React.useState<ClinicalEntryType>(amendOf?.type ?? lockedType ?? "EXAM");
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [note, setNote] = React.useState(amendOf?.note ?? "");
  const [occurredAt, setOccurredAt] = React.useState(new Date().toISOString().slice(0, 16));
  const [amendReason, setAmendReason] = React.useState("");
  const [override, setOverride] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const formErrorRef = React.useRef<HTMLDivElement>(null);

  const fields = TYPE_FIELDS[type];
  // A null role means no clinic is chosen yet; `actor.can` already handles it.
  const savesAsDraft = actor.role ? requiresCoSign(actor.role) : false;
  const extraCap =
    type === "PRESCRIPTION"
      ? ("prescription.write" as const)
      : type === "LAB" || type === "IMAGING"
        ? ("lab.upload" as const)
        : null;
  const allowed = actor.can("record.write") && (!extraCap || actor.can(extraCap));

  // The blocking check: recomputed on every keystroke of the drug field so the
  // warning appears while typing, not at save time (R115).
  const allergyHits = React.useMemo(
    () => (type === "PRESCRIPTION" ? matchAllergies(values.drug ?? "", alerts) : []),
    [type, values.drug, alerts]
  );
  const blockedByAllergy = allergyHits.length > 0 && override.trim().length < 10;

  function set(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const req = isAr ? "هذا الحقل مطلوب" : "This field is required";

    for (const f of fields) {
      const raw = (values[f.name] ?? "").trim();
      if (f.required && !raw) {
        next[f.name] = req;
        continue;
      }
      if (!raw) continue;
      if (f.kind === "number") {
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          next[f.name] = isAr ? "أدخل رقماً" : "Enter a number";
        } else if (typeof f.min === "number" && n < f.min) {
          next[f.name] = isAr ? `أقل قيمة ${f.min}` : `Minimum is ${f.min}`;
        } else if (typeof f.max === "number" && n > f.max) {
          next[f.name] = isAr
            ? `أعلى قيمة ${f.max} — تأكد من الوحدة`
            : `Maximum is ${f.max} — check the unit`;
        }
      }
      if (f.kind === "date" && Number.isNaN(new Date(raw).getTime())) {
        next[f.name] = isAr ? "تاريخ غير صالح" : "That date isn't valid";
      }
    }

    // An entry with no structured content and no note is not a record.
    const hasContent = fields.some((f) => (values[f.name] ?? "").trim()) || note.trim();
    if (!hasContent) {
      next.__form = isAr
        ? "أضف تفصيلاً واحداً على الأقل قبل الحفظ."
        : "Add at least one detail before saving.";
    }

    const when = new Date(occurredAt);
    if (Number.isNaN(when.getTime())) {
      next.occurredAt = isAr ? "وقت غير صالح" : "That time isn't valid";
    } else if (when.getTime() > Date.now() + 60_000) {
      // A clinical record cannot describe the future.
      next.occurredAt = isAr
        ? "لا يمكن تسجيل حدث في المستقبل."
        : "A record can't be dated in the future.";
    }

    if (isAmend && amendReason.trim().length < 5) {
      next.amendReason = isAr
        ? "اذكر سبب التعديل — يُحفظ مع النسخة الجديدة."
        : "Give a reason — it is stored with the new revision.";
    }

    if (allergyHits.length && override.trim().length < 10) {
      next.override = isAr
        ? "اكتب مبرراً سريرياً (١٠ أحرف على الأقل) للمتابعة رغم الحساسية المسجّلة."
        : "Type a clinical justification (10+ characters) to proceed despite the recorded allergy.";
    }

    setErrors(next);
    if (Object.keys(next).length) {
      formErrorRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
      return false;
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { clinicalType: type };
      for (const f of fields) {
        const raw = (values[f.name] ?? "").trim();
        if (!raw) continue;
        payload[f.name] = f.kind === "number" ? Number(raw) : raw;
      }
      if (allergyHits.length) {
        payload.allergyOverride = {
          matched: allergyHits.map((a) => (isAr ? a.labelAr : a.labelEn)),
          justification: override.trim(),
        };
      }

      const saved = isAmend
        ? await api.reviseRecord(amendOf!.entryId, {
            payload,
            note: note.trim() || undefined,
            reason: amendReason.trim(),
          })
        : await api.createRecord({
            catId,
            visitId,
            type: TRANSPORT_KIND[type],
            payload,
            note: note.trim() || undefined,
            occurredAt: new Date(occurredAt).toISOString(),
          });

      const isDraft = saved.status === "DRAFT" || saved.status === "AWAITING_COSIGN" || savesAsDraft;
      toast({
        variant: "success",
        title: isDraft
          ? isAr
            ? "حُفظ كمسودة"
            : "Saved as a draft"
          : isAr
            ? "أُضيف للسجل"
            : "Added to the record",
        description: isDraft
          ? isAr
            ? "ينتظر توقيع طبيب بيطري ليصبح نهائياً."
            : "It waits on a veterinarian's co-signature to become final."
          : isAr
            ? "السجل يُضاف ولا يُستبدل — يبقى هذا الإدخال دائماً."
            : "The record appends, never overwrites — this entry is permanent.",
      });
      onSaved({ id: saved.id, isDraft });
    } catch (err) {
      const f = vetFriendlyError(err, isAr);
      // Values are deliberately NOT cleared — a failed save must never cost a
      // vet their typing (R117).
      setErrors({ __form: f.message });
      toast({ variant: "error", title: f.title, description: f.message });
    } finally {
      setSaving(false);
    }
  }

  if (!allowed) {
    return (
      <div className={cn("rounded-2xl border border-border bg-muted/50 p-5", className)}>
        <p className="text-sm font-medium text-foreground">
          {isAr ? "دورك لا يشمل تدوين هذا النوع." : "Your role doesn't include writing this entry type."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isAr
            ? "مدير العيادة يقدر يفتحها لك أو يغيّر دورك."
            : "A clinic manager can do it for you, or change your role."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className={cn("rounded-2xl border border-border bg-card p-4 sm:p-5", className)}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {isAmend
            ? isAr
              ? "تعديل الإدخال"
              : "Amend entry"
            : isAr
              ? "إدخال سريري جديد"
              : "New clinical entry"}
        </h3>
        {isAmend && (
          <Badge variant="warning">{isAr ? "ينشئ نسخة جديدة" : "Creates a new revision"}</Badge>
        )}
        {savesAsDraft && (
          <Badge variant="info">
            {isAr ? "يُحفظ كمسودة — يحتاج توقيعاً" : "Saves as draft — needs co-sign"}
          </Badge>
        )}
      </div>

      {isAmend && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "الإدخال الأصلي يبقى مقروءاً في السجل. هذا التعديل يُضاف فوقه كنسخة جديدة موقّعة باسمك."
            : "The original entry stays readable in the record. This amendment is appended above it as a new revision, signed with your name."}
        </p>
      )}

      {/* Type switcher — hidden when amending (a revision keeps its type). */}
      {!isAmend && !lockedType && (
        <fieldset className="mt-4">
          <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {isAr ? "النوع" : "Type"}
          </legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ENTRY_TYPES.map((t) => {
              const cap =
                t === "PRESCRIPTION"
                  ? ("prescription.write" as const)
                  : t === "LAB" || t === "IMAGING"
                    ? ("lab.upload" as const)
                    : null;
              if (cap && !actor.can(cap)) return null;
              const active = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    setType(t);
                    setErrors({});
                  }}
                  className={cn(
                    "min-h-[44px] rounded-full border px-3.5 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {isAr ? ENTRY_TYPE_LABELS[t].ar : ENTRY_TYPE_LABELS[t].en}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {/* Structured fields for the chosen type. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const id = `entry-${type}-${f.name}`;
          const err = errors[f.name];
          const label = isAr ? f.ar : f.en;
          const hint = isAr ? f.hintAr : f.hintEn;
          return (
            <div key={f.name} className={cn(f.half ? "sm:col-span-1" : "sm:col-span-2")}>
              <label htmlFor={id} className="block text-xs font-medium text-foreground">
                {label}
                {f.required && (
                  <span className="ms-1 text-destructive" aria-hidden>
                    *
                  </span>
                )}
              </label>
              {f.kind === "textarea" ? (
                <textarea
                  id={id}
                  rows={f.rows ?? 3}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  aria-invalid={!!err || undefined}
                  aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined}
                  className={cn(
                    "mt-1 w-full rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground shadow-e1 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    err ? "border-destructive/60" : "border-input"
                  )}
                />
              ) : f.kind === "select" ? (
                <select
                  id={id}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  aria-invalid={!!err || undefined}
                  aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined}
                  className={cn(
                    "mt-1 h-11 w-full rounded-xl border bg-background px-3 text-sm text-foreground shadow-e1 outline-none",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    err ? "border-destructive/60" : "border-input"
                  )}
                >
                  <option value="">{isAr ? "اختر…" : "Choose…"}</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {isAr ? o.ar : o.en}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id}
                  type={f.kind === "number" ? "number" : f.kind === "date" ? "date" : "text"}
                  inputMode={f.kind === "number" ? "decimal" : undefined}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={values[f.name] ?? ""}
                  onChange={(e) => set(f.name, e.target.value)}
                  invalid={!!err}
                  aria-describedby={err ? `${id}-err` : hint ? `${id}-hint` : undefined}
                  className="mt-1"
                />
              )}
              {err ? (
                <p id={`${id}-err`} role="alert" className="mt-1 text-xs text-destructive">
                  {err}
                </p>
              ) : hint ? (
                <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">
                  {hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* The blocking allergy interaction check. */}
      {allergyHits.length > 0 && (
        <div role="alert" className="mt-4 rounded-2xl border-2 border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertOctagon className="size-5 shrink-0" aria-hidden />
            <p className="text-sm font-semibold">
              {isAr ? "حساسية مسجّلة تطابق هذا الدواء" : "Recorded allergy matches this drug"}
            </p>
          </div>
          <ul className="mt-2 space-y-1">
            {allergyHits.map((a) => (
              <li key={a.id} className="text-sm font-medium text-destructive">
                • {isAr ? a.labelAr : a.labelEn}
              </li>
            ))}
          </ul>
          <label htmlFor="allergy-override" className="mt-3 block text-xs font-medium text-foreground">
            {isAr
              ? "المبرر السريري للمتابعة (يُحفظ باسمك على الوصفة)"
              : "Clinical justification to proceed (stored on the prescription, under your name)"}
          </label>
          <textarea
            id="allergy-override"
            rows={2}
            value={override}
            onChange={(e) => {
              setOverride(e.target.value);
              setErrors((p) => (p.override ? { ...p, override: "" } : p));
            }}
            aria-invalid={!!errors.override || undefined}
            aria-describedby={errors.override ? "allergy-override-err" : undefined}
            className="mt-1 w-full rounded-xl border border-destructive/50 bg-background px-4 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
          {errors.override && (
            <p id="allergy-override-err" className="mt-1 text-xs font-medium text-destructive">
              {errors.override}
            </p>
          )}
        </div>
      )}

      {/* Free-text note + when it happened. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label htmlFor="entry-note" className="block text-xs font-medium text-foreground">
            {isAr ? "ملاحظة" : "Note"}
          </label>
          <textarea
            id="entry-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm text-foreground shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          />
        </div>
        {!isAmend && (
          <div>
            <label htmlFor="entry-when" className="block text-xs font-medium text-foreground">
              {isAr ? "وقت الحدث" : "When it happened"}
            </label>
            <Input
              id="entry-when"
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => {
                setOccurredAt(e.target.value);
                setErrors((p) => (p.occurredAt ? { ...p, occurredAt: "" } : p));
              }}
              invalid={!!errors.occurredAt}
              aria-describedby={errors.occurredAt ? "entry-when-err" : undefined}
              className="mt-1"
            />
            {errors.occurredAt && (
              <p id="entry-when-err" role="alert" className="mt-1 text-xs text-destructive">
                {errors.occurredAt}
              </p>
            )}
          </div>
        )}

        {isAmend && (
          <div>
            <label htmlFor="amend-reason" className="block text-xs font-medium text-foreground">
              {isAr ? "سبب التعديل" : "Reason for the amendment"}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </label>
            <Input
              id="amend-reason"
              value={amendReason}
              onChange={(e) => {
                setAmendReason(e.target.value);
                setErrors((p) => (p.amendReason ? { ...p, amendReason: "" } : p));
              }}
              invalid={!!errors.amendReason}
              aria-describedby={errors.amendReason ? "amend-reason-err" : undefined}
              className="mt-1"
            />
            {errors.amendReason && (
              <p id="amend-reason-err" role="alert" className="mt-1 text-xs text-destructive">
                {errors.amendReason}
              </p>
            )}
          </div>
        )}
      </div>

      {errors.__form && (
        <div
          ref={formErrorRef}
          role="alert"
          className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3"
        >
          <p className="text-sm text-destructive">{errors.__form}</p>
        </div>
      )}

      {savesAsDraft && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
          <Info className="mt-px size-4 shrink-0" aria-hidden />
          {isAr
            ? "ما تكتبه يُحفظ كمسودة موقّعة باسمك، ولا يصبح جزءاً نهائياً من السجل حتى يوقّعه طبيب بيطري. لا شيء يُفقد في الانتظار."
            : "What you write is saved as a draft under your name, and becomes a final part of the record once a veterinarian co-signs it. Nothing is lost while it waits."}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" variant="brand" loading={saving} disabled={blockedByAllergy}>
          {!saving && <Check className="size-4" />}
          {isAmend
            ? isAr
              ? "احفظ النسخة الجديدة"
              : "Save the revision"
            : savesAsDraft
              ? isAr
                ? "احفظ كمسودة"
                : "Save as draft"
              : isAr
                ? "أضف للسجل"
                : "Add to the record"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
        )}
        {blockedByAllergy && (
          <p className="w-full text-xs font-medium text-destructive">
            {isAr
              ? "الحفظ موقوف حتى تكتب المبرر السريري أعلاه."
              : "Saving is held until you write the clinical justification above."}
          </p>
        )}
      </div>
    </form>
  );
}
