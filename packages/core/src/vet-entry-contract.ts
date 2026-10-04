/**
 * The clinical-entry contract — MRC-VET-001 §10, shared verbatim by the API's
 * payload validators and the clinic portal's composer.
 *
 * Why this file exists: the composer and the API were written separately and
 * disagreed on field names for 11 of the 14 entry types (`batch` vs `batchNo`,
 * `drug` vs `medication`, `respRate` vs `respiratoryRate` …) and the composer
 * stuffed a `clinicalType` key the API never declared into every payload. The
 * API validates payloads with `forbidNonWhitelisted`, so every single save was
 * a 400 and no clinic could write a record (UX audit 2026-10-04, Problem 1).
 *
 * The rule from here:
 *   • `VET_ENTRY_FIELDS` is the ONE declaration of every payload field — name,
 *     kind, bounds, enum values and bilingual label.
 *   • The API's class-validator DTOs `implements` the payload interfaces below
 *     and import the enum arrays from here; a unit test compares the DTO
 *     metadata against `VET_ENTRY_FIELDS`, so a rename on either side fails CI.
 *   • The composer renders `VET_ENTRY_FIELDS` and builds the payload with
 *     `buildEntryPayload`, so it cannot invent a key the API doesn't know.
 */

import { VACCINE_CODES, VACCINE_LABELS, type VaccineCode } from "./vet-vaccines";
import { decimalOnly, latinizeDigits } from "./digits";

// ── Entry types (mirror the Prisma ClinicalEntryType enum exactly) ─────────

export const CLINICAL_ENTRY_TYPES = [
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
] as const;
export type ClinicalEntryType = (typeof CLINICAL_ENTRY_TYPES)[number];

/** One wording for every entry kind, in the composer and the record it produces. */
export const CLINICAL_ENTRY_TYPE_LABELS: Record<ClinicalEntryType, { ar: string; en: string }> = {
  EXAM: { ar: "فحص", en: "Examination" },
  DIAGNOSIS: { ar: "تشخيص", en: "Diagnosis" },
  VACCINATION: { ar: "تطعيم", en: "Vaccination" },
  TREATMENT: { ar: "علاج", en: "Treatment" },
  PRESCRIPTION: { ar: "وصفة", en: "Prescription" },
  LAB: { ar: "مختبر", en: "Lab" },
  IMAGING: { ar: "أشعة", en: "Imaging" },
  SURGERY: { ar: "عملية جراحية", en: "Surgery" },
  DENTAL: { ar: "أسنان", en: "Dental" },
  HOSPITALIZATION: { ar: "تنويم", en: "Hospitalisation" },
  WEIGHT: { ar: "وزن", en: "Weight" },
  NUTRITION: { ar: "تغذية", en: "Nutrition" },
  SUPPLEMENT: { ar: "مكمّل غذائي", en: "Supplement" },
  NOTE: { ar: "ملاحظة", en: "Note" },
};

// ── Enumerations used inside payloads ─────────────────────────────────────

export const DIAGNOSIS_SEVERITIES = ["MILD", "MODERATE", "SEVERE", "CRITICAL"] as const;
export const DIAGNOSIS_STATUSES = ["SUSPECTED", "CONFIRMED", "RESOLVED", "CHRONIC", "RULED_OUT"] as const;
export const VACCINATION_ROUTES = ["SC", "IM", "IN", "ORAL", "OTHER"] as const;
export const PRESCRIPTION_FORMS = ["tablet", "capsule", "suspension", "injection", "topical", "drops", "other"] as const;
export const LAB_FLAGS = ["LOW", "NORMAL", "HIGH", "ABNORMAL"] as const;
export const IMAGING_MODALITIES = ["XRAY", "ULTRASOUND", "CT", "MRI", "ENDOSCOPY", "OTHER"] as const;
export const DIET_TYPES = ["DRY", "WET", "MIXED", "RAW", "PRESCRIPTION", "HOME_COOKED", "OTHER"] as const;
export const COMPLIANCE_LEVELS = ["GOOD", "PARTIAL", "POOR", "UNKNOWN"] as const;
export const NOTE_SUBTYPES = ["GENERAL", "HANDLING", "BEHAVIOUR", "OWNER_COMMUNICATION", "REFERRAL"] as const;
export const ATTACHMENT_KINDS = ["xray", "ultrasound", "photo", "pdf", "lab", "other"] as const;

export type DiagnosisSeverity = (typeof DIAGNOSIS_SEVERITIES)[number];
export type DiagnosisStatus = (typeof DIAGNOSIS_STATUSES)[number];
export type VaccinationRoute = (typeof VACCINATION_ROUTES)[number];
export type PrescriptionForm = (typeof PRESCRIPTION_FORMS)[number];
export type LabFlag = (typeof LAB_FLAGS)[number];
export type ImagingModality = (typeof IMAGING_MODALITIES)[number];
export type DietType = (typeof DIET_TYPES)[number];
export type ComplianceLevel = (typeof COMPLIANCE_LEVELS)[number];
export type NoteSubtype = (typeof NOTE_SUBTYPES)[number];
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];

// ── Payload shapes (the API DTOs `implements` these) ──────────────────────

export interface ExamPayload {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  temperatureC?: number;
  heartRate?: number;
  respiratoryRate?: number;
}
export interface DiagnosisPayload {
  condition: string;
  severity?: DiagnosisSeverity;
  status?: DiagnosisStatus;
  notes?: string;
}
export interface VaccinationPayload {
  /** The coded vaccine — what overdue logic and reminders key on. */
  vaccineCode?: VaccineCode;
  /** Display name. Required when `vaccineCode` is OTHER or absent (legacy). */
  vaccine?: string;
  /** The commercial product, separate from what it protects against. */
  product?: string;
  batchNo?: string;
  site?: string;
  route?: VaccinationRoute;
  manufacturer?: string;
  /** Next dose due — the date that becomes the owner's reminder. */
  dueAt?: string;
}
export interface TreatmentPayload {
  diagnosis?: string;
  treatment: string;
  medication?: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number;
  outcome?: string;
  followUpAt?: string;
}
export interface PrescriptionPayload {
  medication: string;
  strength?: string;
  form?: PrescriptionForm;
  dosage: string;
  frequency: string;
  durationDays?: number;
  quantity?: string;
  instructions?: string;
  refillsAllowed?: number;
  expiresAt?: string;
}
export interface LabResult {
  analyte: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: LabFlag;
}
export interface LabPayload {
  panel: string;
  laboratory?: string;
  sampledAt?: string;
  results?: LabResult[];
  interpretation?: string;
}
export interface ImagingPayload {
  modality: ImagingModality;
  region: string;
  findings?: string;
  interpretation?: string;
}
export interface SurgeryPayload {
  procedure: string;
  anaesthesia?: string;
  complications?: string;
  dischargeInstructions?: string;
  followUpAt?: string;
}
export interface DentalPayload {
  procedure: string;
  grade?: number;
  extractions?: string[];
  findings?: string;
  homeCare?: string;
}
export interface HospitalizationPayload {
  admittedAt: string;
  dischargedAt?: string;
  reason: string;
  ward?: string;
  monitoring?: string;
  dischargeInstructions?: string;
}
export interface WeightPayload {
  weightKg: number;
  bcs?: number;
  method?: string;
}
export interface NutritionPayload {
  dietType: DietType;
  brand?: string;
  product?: string;
  caloriesPerDay?: number;
  waterIntake?: string;
  schedule?: string;
  notes?: string;
}
export interface SupplementPayload {
  name: string;
  brand?: string;
  reason?: string;
  dosage?: string;
  frequency?: string;
  compliance?: ComplianceLevel;
}
export interface NotePayload {
  text: string;
  subtype?: NoteSubtype;
}

export interface VetEntryPayloads {
  EXAM: ExamPayload;
  DIAGNOSIS: DiagnosisPayload;
  VACCINATION: VaccinationPayload;
  TREATMENT: TreatmentPayload;
  PRESCRIPTION: PrescriptionPayload;
  LAB: LabPayload;
  IMAGING: ImagingPayload;
  SURGERY: SurgeryPayload;
  DENTAL: DentalPayload;
  HOSPITALIZATION: HospitalizationPayload;
  WEIGHT: WeightPayload;
  NUTRITION: NutritionPayload;
  SUPPLEMENT: SupplementPayload;
  NOTE: NotePayload;
}

// ── The field declaration ─────────────────────────────────────────────────

/**
 * How a field travels:
 *   text / textarea → string · int / decimal → number · date / datetime → ISO
 *   string · enum → one of `options` · stringList → string[] · labResults →
 *   LabResult[].
 */
export type VetFieldKind =
  | "text"
  | "textarea"
  | "int"
  | "decimal"
  | "date"
  | "datetime"
  | "enum"
  | "stringList"
  | "labResults";

export interface VetFieldOption {
  value: string;
  ar: string;
  en: string;
}

export interface VetFieldSpec<N extends string = string> {
  name: N;
  kind: VetFieldKind;
  /** Enforced by the API: a payload without it is a 400. */
  required?: boolean;
  /**
   * Asked for by the composer but not enforced by the API, either because
   * older clients/records legitimately omit it (a legacy free-text vaccine has
   * no code) or because a vet may genuinely not know it yet.
   */
  uiRequired?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  /** Enum values (and, for `int`, a closed picklist rendered as a select). */
  options?: readonly VetFieldOption[];
  label: { ar: string; en: string };
  hint?: { ar: string; en: string };
  /** Composer layout only. */
  half?: boolean;
  rows?: number;
}

type FieldsFor<T> = ReadonlyArray<VetFieldSpec<Extract<keyof T, string>>>;
export type VetEntryFieldMap = { [K in ClinicalEntryType]: FieldsFor<VetEntryPayloads[K]> };

const opt = (value: string, ar: string, en: string): VetFieldOption => ({ value, ar, en });

const SEVERITY_OPTIONS = [
  opt("MILD", "خفيفة", "Mild"),
  opt("MODERATE", "متوسطة", "Moderate"),
  opt("SEVERE", "شديدة", "Severe"),
  opt("CRITICAL", "حرجة", "Critical"),
] as const;
const DIAGNOSIS_STATUS_OPTIONS = [
  opt("SUSPECTED", "مشتبه به", "Suspected"),
  opt("CONFIRMED", "مؤكد", "Confirmed"),
  opt("CHRONIC", "مزمن", "Chronic"),
  opt("RESOLVED", "زال", "Resolved"),
  opt("RULED_OUT", "استُبعد", "Ruled out"),
] as const;
const ROUTE_OPTIONS = [
  opt("SC", "تحت الجلد", "Subcutaneous"),
  opt("IM", "عضلي", "Intramuscular"),
  opt("IN", "أنفي", "Intranasal"),
  opt("ORAL", "فموي", "Oral"),
  opt("OTHER", "أخرى", "Other"),
] as const;
const FORM_OPTIONS = [
  opt("tablet", "أقراص", "Tablet"),
  opt("capsule", "كبسولات", "Capsule"),
  opt("suspension", "معلّق", "Suspension"),
  opt("injection", "حقن", "Injection"),
  opt("topical", "موضعي", "Topical"),
  opt("drops", "قطرات", "Drops"),
  opt("other", "أخرى", "Other"),
] as const;
const MODALITY_OPTIONS = [
  opt("XRAY", "أشعة سينية", "X-ray"),
  opt("ULTRASOUND", "موجات صوتية", "Ultrasound"),
  opt("CT", "مقطعية", "CT"),
  opt("MRI", "رنين مغناطيسي", "MRI"),
  opt("ENDOSCOPY", "منظار", "Endoscopy"),
  opt("OTHER", "أخرى", "Other"),
] as const;
const DIET_OPTIONS = [
  opt("DRY", "جاف", "Dry"),
  opt("WET", "رطب", "Wet"),
  opt("MIXED", "مختلط", "Mixed"),
  opt("RAW", "نيء", "Raw"),
  opt("PRESCRIPTION", "علاجي", "Prescription diet"),
  opt("HOME_COOKED", "منزلي", "Home-cooked"),
  opt("OTHER", "أخرى", "Other"),
] as const;
const COMPLIANCE_OPTIONS = [
  opt("GOOD", "جيد", "Good"),
  opt("PARTIAL", "جزئي", "Partial"),
  opt("POOR", "ضعيف", "Poor"),
  opt("UNKNOWN", "غير معروف", "Unknown"),
] as const;
const NOTE_SUBTYPE_OPTIONS = [
  opt("GENERAL", "عامة", "General"),
  opt("HANDLING", "طريقة التعامل", "Handling"),
  opt("BEHAVIOUR", "السلوك", "Behaviour"),
  opt("OWNER_COMMUNICATION", "تواصل مع المالك", "Owner communication"),
  opt("REFERRAL", "إحالة", "Referral"),
] as const;
const DENTAL_GRADE_OPTIONS = [
  opt("0", "0 — سليم", "0 — healthy"),
  opt("1", "1 — التهاب لثة", "1 — gingivitis"),
  opt("2", "2 — مبكر", "2 — early"),
  opt("3", "3 — متوسط", "3 — moderate"),
  opt("4", "4 — متقدم", "4 — advanced"),
] as const;
const VACCINE_OPTIONS: readonly VetFieldOption[] = VACCINE_CODES.map((code: VaccineCode) =>
  opt(code, VACCINE_LABELS[code].ar, VACCINE_LABELS[code].en)
);

/**
 * Every payload field of every entry type. The composer renders exactly this;
 * the API validates exactly this (see the DTO parity test in apps/api).
 */
export const VET_ENTRY_FIELDS: VetEntryFieldMap = {
  EXAM: [
    { name: "subjective", kind: "textarea", maxLength: 4000, rows: 3, label: { ar: "الشكوى (ما يرويه المالك)", en: "Subjective — what the owner reports" } },
    { name: "objective", kind: "textarea", maxLength: 4000, rows: 3, label: { ar: "الفحص والعلامات", en: "Objective — findings" } },
    { name: "assessment", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "التقييم", en: "Assessment" } },
    { name: "plan", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "الخطة", en: "Plan" } },
    { name: "temperatureC", kind: "decimal", min: 20, max: 45, half: true, label: { ar: "الحرارة (°م)", en: "Temperature (°C)" } },
    { name: "heartRate", kind: "int", min: 20, max: 400, half: true, label: { ar: "النبض (نبضة/د)", en: "Heart rate (bpm)" } },
    { name: "respiratoryRate", kind: "int", min: 4, max: 200, half: true, label: { ar: "التنفس (نفس/د)", en: "Respiratory rate (breaths/min)" } },
  ],
  DIAGNOSIS: [
    { name: "condition", kind: "text", required: true, maxLength: 200, label: { ar: "التشخيص", en: "Condition" } },
    { name: "severity", kind: "enum", options: SEVERITY_OPTIONS, half: true, label: { ar: "الشدة", en: "Severity" } },
    { name: "status", kind: "enum", options: DIAGNOSIS_STATUS_OPTIONS, half: true, label: { ar: "الحالة", en: "Status" } },
    { name: "notes", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "أساس التشخيص وملاحظات", en: "Basis and notes" } },
  ],
  VACCINATION: [
    { name: "vaccineCode", kind: "enum", uiRequired: true, half: true, options: VACCINE_OPTIONS, label: { ar: "اللقاح", en: "Vaccine" } },
    {
      name: "vaccine",
      kind: "text",
      maxLength: 120,
      half: true,
      label: { ar: "اسم اللقاح (عند «أخرى»)", en: "Vaccine name (for “Other”)" },
      hint: { ar: "مطلوب فقط عند اختيار «أخرى»", en: "Only needed when you choose “Other”" },
    },
    { name: "product", kind: "text", maxLength: 120, half: true, label: { ar: "المنتج التجاري", en: "Product" }, hint: { ar: "مثال: Purevax RCP", en: "e.g. Purevax RCP" } },
    { name: "manufacturer", kind: "text", maxLength: 120, half: true, label: { ar: "الشركة المصنّعة", en: "Manufacturer" } },
    { name: "batchNo", kind: "text", maxLength: 60, uiRequired: true, half: true, label: { ar: "رقم التشغيلة", en: "Batch number" } },
    { name: "route", kind: "enum", options: ROUTE_OPTIONS, uiRequired: true, half: true, label: { ar: "طريقة الإعطاء", en: "Route" } },
    { name: "site", kind: "text", maxLength: 80, half: true, label: { ar: "موضع الحقن", en: "Injection site" } },
    {
      name: "dueAt",
      kind: "date",
      uiRequired: true,
      half: true,
      label: { ar: "موعد الجرعة القادمة", en: "Next dose due" },
      hint: { ar: "يصل المالك تذكير تلقائي قبله", en: "Becomes the owner's automatic reminder" },
    },
  ],
  TREATMENT: [
    { name: "treatment", kind: "text", required: true, maxLength: 400, label: { ar: "العلاج المُعطى", en: "Treatment given" } },
    { name: "diagnosis", kind: "text", maxLength: 200, label: { ar: "لأجل (التشخيص)", en: "For (diagnosis)" } },
    { name: "medication", kind: "text", maxLength: 160, half: true, label: { ar: "الدواء", en: "Medication" } },
    { name: "dosage", kind: "text", maxLength: 120, half: true, label: { ar: "الجرعة", en: "Dose" } },
    { name: "frequency", kind: "text", maxLength: 120, half: true, label: { ar: "التكرار", en: "Frequency" } },
    { name: "durationDays", kind: "int", min: 1, max: 365, half: true, label: { ar: "المدة (أيام)", en: "Duration (days)" } },
    { name: "outcome", kind: "textarea", maxLength: 1000, rows: 2, label: { ar: "الاستجابة والنتيجة", en: "Response and outcome" } },
    { name: "followUpAt", kind: "date", half: true, label: { ar: "موعد المتابعة", en: "Follow-up date" } },
  ],
  PRESCRIPTION: [
    { name: "medication", kind: "text", required: true, maxLength: 160, label: { ar: "الدواء", en: "Medication" } },
    { name: "strength", kind: "text", maxLength: 60, half: true, label: { ar: "التركيز", en: "Strength" }, hint: { ar: "مثال: 50 ملغ", en: "e.g. 50 mg" } },
    { name: "form", kind: "enum", options: FORM_OPTIONS, half: true, label: { ar: "الشكل الدوائي", en: "Form" } },
    { name: "dosage", kind: "text", required: true, maxLength: 120, half: true, label: { ar: "الجرعة", en: "Dose" } },
    { name: "frequency", kind: "text", required: true, maxLength: 120, half: true, label: { ar: "التكرار", en: "Frequency" }, hint: { ar: "مثال: مرتين يومياً", en: "e.g. twice daily" } },
    { name: "durationDays", kind: "int", min: 1, max: 365, uiRequired: true, half: true, label: { ar: "المدة (أيام)", en: "Duration (days)" } },
    { name: "quantity", kind: "text", maxLength: 80, half: true, label: { ar: "الكمية", en: "Quantity" }, hint: { ar: "مثال: 20 قرصاً", en: "e.g. 20 tablets" } },
    { name: "refillsAllowed", kind: "int", min: 0, max: 12, half: true, label: { ar: "عدد مرات إعادة الصرف", en: "Refills allowed" } },
    { name: "expiresAt", kind: "date", half: true, label: { ar: "تنتهي صلاحية الوصفة", en: "Prescription expires" } },
    { name: "instructions", kind: "textarea", maxLength: 1000, rows: 2, label: { ar: "تعليمات للمالك", en: "Owner instructions" } },
  ],
  LAB: [
    { name: "panel", kind: "text", required: true, maxLength: 160, label: { ar: "الفحص", en: "Panel / test" } },
    { name: "laboratory", kind: "text", maxLength: 160, half: true, label: { ar: "المختبر", en: "Laboratory" } },
    { name: "sampledAt", kind: "date", half: true, label: { ar: "تاريخ أخذ العينة", en: "Sampled on" } },
    { name: "results", kind: "labResults", label: { ar: "النتائج", en: "Results" } },
    { name: "interpretation", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "التفسير السريري", en: "Clinical interpretation" } },
  ],
  IMAGING: [
    { name: "modality", kind: "enum", required: true, options: MODALITY_OPTIONS, half: true, label: { ar: "نوع التصوير", en: "Modality" } },
    { name: "region", kind: "text", required: true, maxLength: 200, half: true, label: { ar: "المنطقة", en: "Body region" } },
    { name: "findings", kind: "textarea", maxLength: 4000, rows: 3, label: { ar: "الموجودات", en: "Findings" } },
    { name: "interpretation", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "التفسير", en: "Interpretation" } },
  ],
  SURGERY: [
    { name: "procedure", kind: "text", required: true, maxLength: 200, label: { ar: "العملية", en: "Procedure" } },
    { name: "anaesthesia", kind: "textarea", maxLength: 1000, rows: 2, label: { ar: "التخدير", en: "Anaesthesia" } },
    {
      name: "complications",
      kind: "textarea",
      maxLength: 2000,
      rows: 2,
      label: { ar: "المضاعفات", en: "Complications" },
      hint: { ar: "اكتب «لا يوجد» إذا مرّت بسلام", en: "Write “none” if uneventful" },
    },
    { name: "dischargeInstructions", kind: "textarea", maxLength: 4000, rows: 3, uiRequired: true, label: { ar: "تعليمات الخروج", en: "Discharge instructions" } },
    { name: "followUpAt", kind: "date", half: true, label: { ar: "موعد المتابعة", en: "Follow-up date" } },
  ],
  DENTAL: [
    { name: "procedure", kind: "text", required: true, maxLength: 200, label: { ar: "الإجراء", en: "Procedure" } },
    { name: "grade", kind: "int", min: 0, max: 4, options: DENTAL_GRADE_OPTIONS, half: true, label: { ar: "درجة أمراض اللثة", en: "Periodontal grade" } },
    {
      name: "extractions",
      kind: "stringList",
      max: 60,
      maxLength: 20,
      half: true,
      label: { ar: "الأسنان المخلوعة", en: "Teeth extracted" },
      hint: { ar: "افصل بفاصلة: 307، 407", en: "Comma-separated: 307, 407" },
    },
    { name: "findings", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "الموجودات", en: "Findings" } },
    { name: "homeCare", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "العناية المنزلية", en: "Home care" } },
  ],
  HOSPITALIZATION: [
    { name: "reason", kind: "text", required: true, maxLength: 400, label: { ar: "سبب التنويم", en: "Reason for admission" } },
    { name: "admittedAt", kind: "datetime", required: true, half: true, label: { ar: "وقت الدخول", en: "Admitted" } },
    { name: "dischargedAt", kind: "datetime", half: true, label: { ar: "وقت الخروج", en: "Discharged" } },
    { name: "ward", kind: "text", maxLength: 120, half: true, label: { ar: "القسم / القفص", en: "Ward / kennel" } },
    { name: "monitoring", kind: "textarea", maxLength: 4000, rows: 3, label: { ar: "سير الحالة والمراقبة", en: "Clinical course and monitoring" } },
    { name: "dischargeInstructions", kind: "textarea", maxLength: 4000, rows: 2, label: { ar: "تعليمات الخروج", en: "Discharge instructions" } },
  ],
  WEIGHT: [
    { name: "weightKg", kind: "decimal", required: true, min: 0.05, max: 40, half: true, label: { ar: "الوزن (كجم)", en: "Weight (kg)" } },
    {
      name: "bcs",
      kind: "int",
      min: 1,
      max: 9,
      half: true,
      label: { ar: "درجة حالة الجسم (BCS)", en: "Body condition score (BCS)" },
      hint: { ar: "من 1 إلى 9 — المثالي 4–5", en: "1 to 9 — 4–5 is ideal" },
    },
    { name: "method", kind: "text", maxLength: 400, label: { ar: "ملاحظة القياس", en: "Measurement note" } },
  ],
  NUTRITION: [
    { name: "dietType", kind: "enum", required: true, options: DIET_OPTIONS, half: true, label: { ar: "نوع الغذاء", en: "Diet type" } },
    { name: "brand", kind: "text", maxLength: 120, half: true, label: { ar: "العلامة التجارية", en: "Brand" } },
    { name: "product", kind: "text", maxLength: 160, half: true, label: { ar: "المنتج", en: "Product" } },
    { name: "caloriesPerDay", kind: "int", min: 10, max: 2000, half: true, label: { ar: "السعرات اليومية", en: "Calories per day" } },
    { name: "waterIntake", kind: "text", maxLength: 120, half: true, label: { ar: "شرب الماء", en: "Water intake" } },
    { name: "schedule", kind: "text", maxLength: 400, half: true, label: { ar: "مواعيد الوجبات", en: "Feeding schedule" } },
    { name: "notes", kind: "textarea", maxLength: 2000, rows: 2, label: { ar: "السبب السريري وملاحظات", en: "Clinical rationale and notes" } },
  ],
  SUPPLEMENT: [
    { name: "name", kind: "text", required: true, maxLength: 160, label: { ar: "المكمّل", en: "Supplement" } },
    { name: "brand", kind: "text", maxLength: 120, half: true, label: { ar: "العلامة التجارية", en: "Brand" } },
    { name: "reason", kind: "text", maxLength: 400, half: true, label: { ar: "السبب", en: "Reason" } },
    { name: "dosage", kind: "text", maxLength: 120, half: true, label: { ar: "الجرعة", en: "Dose" } },
    { name: "frequency", kind: "text", maxLength: 120, half: true, label: { ar: "التكرار", en: "Frequency" } },
    { name: "compliance", kind: "enum", options: COMPLIANCE_OPTIONS, half: true, label: { ar: "الالتزام", en: "Compliance" } },
  ],
  NOTE: [
    {
      name: "subtype",
      kind: "enum",
      options: NOTE_SUBTYPE_OPTIONS,
      half: true,
      label: { ar: "نوع الملاحظة", en: "Note type" },
      hint: {
        ar: "ملاحظات «طريقة التعامل» و«السلوك» تظهر في شريط التنبيهات لكل عيادة",
        en: "“Handling” and “Behaviour” notes surface in every clinic's alerts band",
      },
    },
    { name: "text", kind: "textarea", required: true, maxLength: 4000, rows: 3, label: { ar: "النص", en: "Text" } },
  ],
};

// ── Building a payload from typed input ───────────────────────────────────

/** Errors are keyed by field name; `__form` is reserved for the whole entry. */
export type EntryFieldErrors = Record<string, { ar: string; en: string }>;

/**
 * Parse a number as people type it at a clinic counter: Arabic-Indic or
 * Eastern-Arabic digits, the Arabic decimal separator (٫) or a comma.
 * Returns null when the text is not a number at all.
 */
export function parseClinicalNumber(raw: string, kind: "int" | "decimal"): number | null {
  const cleaned = decimalOnly(latinizeDigits(raw.trim()));
  if (!cleaned || cleaned === ".") return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  if (kind === "int" && !Number.isInteger(n)) return null;
  return n;
}

/** Composer-typed lab row (all strings, as typed). */
export interface LabResultDraft {
  analyte: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: string;
}

export type EntryDraftValue = string | LabResultDraft[];

/**
 * Turn the composer's raw values (all strings, as typed) into a payload the
 * API will accept — or the reasons it would not. Unknown keys are dropped
 * rather than sent: the payload contains exactly the declared fields.
 *
 * Validation mirrors the API (required, bounds, enums, lengths) plus the
 * composer's `uiRequired` asks, so a vet hears about a problem as they type
 * instead of from a 400 (R115).
 */
export function buildEntryPayload<T extends ClinicalEntryType>(
  type: T,
  values: Record<string, EntryDraftValue | undefined>,
  opts: { enforceUiRequired?: boolean } = {}
): { ok: true; payload: VetEntryPayloads[T] } | { ok: false; errors: EntryFieldErrors; payload: Partial<VetEntryPayloads[T]> } {
  const enforceUi = opts.enforceUiRequired ?? true;
  const fields = VET_ENTRY_FIELDS[type] as ReadonlyArray<VetFieldSpec>;
  const out: Record<string, unknown> = {};
  const errors: EntryFieldErrors = {};
  const req = { ar: "هذا الحقل مطلوب", en: "This field is required" };

  for (const f of fields) {
    const raw = values[f.name];
    if (f.kind === "labResults") {
      const rows = Array.isArray(raw) ? raw : [];
      const kept: LabResult[] = [];
      for (const r of rows) {
        const analyte = (r.analyte ?? "").trim();
        const value = (r.value ?? "").trim();
        if (!analyte && !value) continue;
        if (!analyte || !value) {
          errors[f.name] = { ar: "كل نتيجة تحتاج اسم الفحص وقيمته", en: "Each result needs an analyte and a value" };
          continue;
        }
        const row: LabResult = { analyte, value: latinizeDigits(value).replace(/٫/g, ".") };
        if (r.unit?.trim()) row.unit = r.unit.trim();
        if (r.referenceRange?.trim()) row.referenceRange = latinizeDigits(r.referenceRange.trim());
        if (r.flag && (LAB_FLAGS as readonly string[]).includes(r.flag)) row.flag = r.flag as LabFlag;
        kept.push(row);
      }
      if (kept.length) out[f.name] = kept;
      else if (f.required) errors[f.name] = req;
      continue;
    }

    const text = typeof raw === "string" ? raw.trim() : "";
    if (!text) {
      if (f.required || (enforceUi && f.uiRequired)) errors[f.name] = req;
      continue;
    }

    switch (f.kind) {
      case "int":
      case "decimal": {
        const n = parseClinicalNumber(text, f.kind);
        if (n === null) {
          errors[f.name] =
            f.kind === "int"
              ? { ar: "أدخل رقماً صحيحاً", en: "Enter a whole number" }
              : { ar: "أدخل رقماً", en: "Enter a number" };
        } else if (typeof f.min === "number" && n < f.min) {
          errors[f.name] = { ar: `أقل قيمة ${f.min}`, en: `Minimum is ${f.min}` };
        } else if (typeof f.max === "number" && n > f.max) {
          errors[f.name] = { ar: `أعلى قيمة ${f.max} — تأكد من الوحدة`, en: `Maximum is ${f.max} — check the unit` };
        } else {
          out[f.name] = n;
        }
        break;
      }
      case "enum": {
        const allowed = (f.options ?? []).map((o) => o.value);
        if (!allowed.includes(text)) errors[f.name] = { ar: "اختر من القائمة", en: "Choose from the list" };
        else out[f.name] = text;
        break;
      }
      case "date":
      case "datetime": {
        const d = new Date(text);
        if (Number.isNaN(d.getTime())) errors[f.name] = { ar: "تاريخ غير صالح", en: "That date isn't valid" };
        // A bare date stays a date; a datetime travels as a full ISO instant.
        else out[f.name] = f.kind === "date" && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : d.toISOString();
        break;
      }
      case "stringList": {
        const items = latinizeDigits(text)
          .split(/[,،\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (typeof f.max === "number" && items.length > f.max) {
          errors[f.name] = { ar: `بحد أقصى ${f.max}`, en: `At most ${f.max}` };
        } else if (typeof f.maxLength === "number" && items.some((s) => s.length > f.maxLength!)) {
          errors[f.name] = { ar: "أحد العناصر طويل جداً", en: "One of the items is too long" };
        } else if (items.length) {
          out[f.name] = items;
        }
        break;
      }
      default: {
        if (typeof f.maxLength === "number" && text.length > f.maxLength) {
          errors[f.name] = {
            ar: `الحد الأقصى ${f.maxLength} حرفاً`,
            en: `At most ${f.maxLength} characters`,
          };
        } else {
          out[f.name] = text;
        }
      }
    }
  }

  // Cross-field rules the API also enforces.
  if (type === "VACCINATION") {
    const code = out.vaccineCode as string | undefined;
    if ((code === "OTHER" || !code) && !out.vaccine && !errors.vaccineCode) {
      errors.vaccine = { ar: "اكتب اسم اللقاح", en: "Name the vaccine" };
    }
  }

  if (Object.keys(errors).length) {
    return { ok: false, errors, payload: out as Partial<VetEntryPayloads[T]> };
  }
  return { ok: true, payload: out as unknown as VetEntryPayloads[T] };
}

// ── Request / response envelopes ──────────────────────────────────────────

/** A typed clinical override of a recorded-allergy match. Sent beside the payload. */
export interface VetAllergyOverride {
  /** The recorded allergens the drug matched, as shown to the vet. */
  matched: string[];
  /** The clinician's justification — at least 10 characters. */
  justification: string;
}

export const ALLERGY_OVERRIDE_MIN_LENGTH = 10;

export interface VetCreateRecordRequest<T extends ClinicalEntryType = ClinicalEntryType> {
  catId: string;
  visitId?: string;
  type: T;
  payload: VetEntryPayloads[T];
  note?: string;
  occurredAt?: string;
  allergyOverride?: VetAllergyOverride;
}

export interface VetReviseRecordRequest<T extends ClinicalEntryType = ClinicalEntryType> {
  payload: VetEntryPayloads[T];
  note?: string;
  reason?: string;
  occurredAt?: string;
  allergyOverride?: VetAllergyOverride;
}

export interface VetCoSignState {
  required: boolean;
  notice: { ar: string; en: string } | null;
}

/** What a record write returns. `E` is the API's presented entry. */
export interface VetRecordWriteResponse<E = unknown> {
  entry: E;
  sideEffects: Record<string, unknown> & { deferred: boolean };
  coSign: VetCoSignState;
  /** Revise only: the entry this one supersedes. */
  supersededEntryId?: string;
  notice?: { ar: string; en: string };
}

export const PRESCRIPTION_ACTIONS = ["dispense", "refill", "complete", "cancel"] as const;
export type PrescriptionAction = (typeof PRESCRIPTION_ACTIONS)[number];

export interface VetPrescriptionStatusRequest {
  action: PrescriptionAction;
  /** Required for `cancel` — the owner deserves a reason. */
  reason?: string;
  notifyOwner?: boolean;
}

/** Bilingual action labels — buttons name the action (R086). */
export const PRESCRIPTION_ACTION_LABELS: Record<PrescriptionAction, { ar: string; en: string }> = {
  dispense: { ar: "صُرف", en: "Dispensed" },
  refill: { ar: "إعادة صرف", en: "Refill" },
  complete: { ar: "اكتمل العلاج", en: "Course complete" },
  cancel: { ar: "ألغِ الوصفة", en: "Cancel prescription" },
};
