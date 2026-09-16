/**
 * Veterinary clinic registration — MRC-VET-002.
 *
 * Everything the API and the wizard must agree on lives here, so "is this
 * registration complete?" has exactly one answer on both sides of the wire:
 * the step list, the field rules, the completeness check, the document rules,
 * and the exact bilingual text a clinic accepts. The text is versioned and the
 * API hashes the canonical rendering, so the evidence of acceptance names the
 * precise words that were on screen.
 *
 * Pure TypeScript: no Node or DOM APIs (the web bundle imports this too).
 */

import type { VetRole } from "./vet-permissions";

/* ────────────────────────────────────────────────────────────────────────── */
/* Lifecycle                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type ClinicOrgStatus =
  | "APPLIED"
  | "INVITED"
  | "REGISTERING"
  | "SUBMITTED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "IN_REVIEW"
  | "APPROVED"
  | "LIVE"
  | "SUSPENDED"
  | "OFFBOARDED";

/** Statuses in which the owner may still edit the registration. */
export const REGISTRATION_EDITABLE_STATUSES: readonly ClinicOrgStatus[] = [
  "INVITED",
  "REGISTERING",
  "CHANGES_REQUESTED",
];

/** Statuses a Moracat reviewer can act on (approve / request changes / reject). */
export const REGISTRATION_REVIEWABLE_STATUSES: readonly ClinicOrgStatus[] = ["SUBMITTED", "IN_REVIEW"];

export const CLINIC_STATUS_LABELS: Record<ClinicOrgStatus, { ar: string; en: string }> = {
  APPLIED: { ar: "طلب قديم", en: "Legacy application" },
  INVITED: { ar: "تمت الدعوة", en: "Invited" },
  REGISTERING: { ar: "يعبّئ التسجيل", en: "Registering" },
  SUBMITTED: { ar: "بانتظار المراجعة", en: "Awaiting review" },
  CHANGES_REQUESTED: { ar: "مطلوب تعديلات", en: "Changes requested" },
  REJECTED: { ar: "مرفوضة", en: "Rejected" },
  IN_REVIEW: { ar: "قيد المراجعة", en: "In review" },
  APPROVED: { ar: "مقبولة — تجهيز", en: "Approved — setting up" },
  LIVE: { ar: "فعّالة", en: "Live" },
  SUSPENDED: { ar: "موقوفة", en: "Suspended" },
  OFFBOARDED: { ar: "غادرت الشبكة", en: "Offboarded" },
};

/** Registration invitations expire after 14 days (resendable). */
export const REGISTRATION_INVITE_TTL_DAYS = 14;

/* ────────────────────────────────────────────────────────────────────────── */
/* Wizard steps                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

export type RegistrationStep = "account" | "clinic" | "branches" | "documents" | "team" | "terms";

/** Steps a reviewer can reopen. The account step is never reopened. */
export const REOPENABLE_STEPS: readonly RegistrationStep[] = ["clinic", "branches", "documents", "team"];

export const REGISTRATION_STEPS: { key: RegistrationStep; ar: string; en: string; hintAr: string; hintEn: string }[] = [
  {
    key: "account",
    ar: "حساب المالك",
    en: "Owner account",
    hintAr: "حسابك الشخصي الذي تدير به العيادة.",
    hintEn: "Your personal account for running the clinic.",
  },
  {
    key: "clinic",
    ar: "بيانات المنشأة",
    en: "Clinic legal details",
    hintAr: "كما هي مكتوبة في السجل التجاري.",
    hintEn: "Exactly as printed on the commercial registration.",
  },
  {
    key: "branches",
    ar: "الفروع والموقع",
    en: "Branches & location",
    hintAr: "العنوان، الموقع على الخريطة، أوقات العمل، والترخيص البيطري.",
    hintEn: "Address, map pin, opening hours and the veterinary licence.",
  },
  {
    key: "documents",
    ar: "المستندات",
    en: "Documents",
    hintAr: "السجل التجاري وترخيص وزارة البيئة لكل فرع.",
    hintEn: "Commercial registration and a MEWA licence for each branch.",
  },
  {
    key: "team",
    ar: "الأطباء والفريق",
    en: "Doctors & team",
    hintAr: "من يحتاج حساباً — يصلهم رابط الدعوة عند الإرسال.",
    hintEn: "Who needs an account — they get their invitation when you submit.",
  },
  {
    key: "terms",
    ar: "المراجعة والشروط",
    en: "Review & terms",
    hintAr: "راجع كل شيء، ثم وافق على اتفاقية الشراكة.",
    hintEn: "Check everything, then accept the partner agreement.",
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Field rules (Saudi formats)                                                */
/* ────────────────────────────────────────────────────────────────────────── */

/** Arabic-Indic and Persian digits → ASCII, so a pasted "١٠١٠..." validates. */
export function asciiDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Commercial registration: 10 digits. */
export const CR_NUMBER_RE = /^\d{10}$/;
/** Unified national number (الرقم الوطني الموحد): 10 digits starting with 7. */
export const UNIFIED_NUMBER_RE = /^7\d{9}$/;
/** VAT registration: 15 digits, starting and ending with 3. */
export const VAT_NUMBER_RE = /^3\d{13}3$/;
/** National Address short code: 4 letters + 4 digits, e.g. RRRD2929. */
export const NATIONAL_ADDRESS_CODE_RE = /^[A-Z]{4}\d{4}$/;
/** Saudi mobile in E.164. */
export const SAUDI_MOBILE_E164_RE = /^\+9665\d{8}$/;

/** "05x xxx xxxx" / "5xxxxxxxx" / "+9665…" / "009665…" → "+9665xxxxxxxx", else null. */
export function normalizeSaudiMobile(raw: string): string | null {
  const digits = asciiDigits(raw).replace(/[^\d+]/g, "");
  let local: string | null = null;
  if (/^\+9665\d{8}$/.test(digits)) local = digits.slice(4);
  else if (/^009665\d{8}$/.test(digits)) local = digits.slice(5);
  else if (/^9665\d{8}$/.test(digits)) local = digits.slice(3);
  else if (/^05\d{8}$/.test(digits)) local = digits.slice(1);
  else if (/^5\d{8}$/.test(digits)) local = digits;
  return local ? `+966${local}` : null;
}

export function normalizeNationalAddressCode(raw: string): string {
  return asciiDigits(raw).replace(/\s+/g, "").toUpperCase();
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Documents                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export type ClinicDocumentKind = "CR" | "VAT" | "MEWA_LICENCE" | "PRACTITIONER_LICENCE" | "INSURANCE" | "OTHER";

export const CLINIC_DOCUMENT_LABELS: Record<ClinicDocumentKind, { ar: string; en: string }> = {
  CR: { ar: "شهادة السجل التجاري", en: "Commercial registration certificate" },
  VAT: { ar: "شهادة التسجيل في ضريبة القيمة المضافة", en: "VAT registration certificate" },
  MEWA_LICENCE: { ar: "ترخيص وزارة البيئة والمياه والزراعة", en: "MEWA veterinary licence" },
  PRACTITIONER_LICENCE: { ar: "ترخيص مزاولة المهنة", en: "Practitioner licence" },
  INSURANCE: { ar: "وثيقة التأمين", en: "Insurance policy" },
  OTHER: { ar: "مستند آخر", en: "Other document" },
};

/** Which kinds are stored against the organisation versus a branch. */
export const ORG_LEVEL_DOCUMENT_KINDS: readonly ClinicDocumentKind[] = ["CR", "VAT", "INSURANCE", "OTHER"];
export const BRANCH_LEVEL_DOCUMENT_KINDS: readonly ClinicDocumentKind[] = ["MEWA_LICENCE"];

export const CLINIC_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CLINIC_DOCUMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png"] as const;

/* ────────────────────────────────────────────────────────────────────────── */
/* Team                                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

/** Roles an owner can list in the wizard (the owner seat already exists). */
export const REGISTRATION_TEAM_ROLES: readonly VetRole[] = [
  "VET_SENIOR",
  "VET",
  "INTERN",
  "VET_TECH",
  "MANAGER",
  "RECEPTION",
  "FINANCE",
];

/** Roles that practise medicine — they must carry a practitioner licence. */
export const DOCTOR_ROLES: readonly VetRole[] = ["VET_SENIOR", "VET", "INTERN"];

export function isDoctorRole(role: VetRole): boolean {
  return DOCTOR_ROLES.includes(role);
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Completeness — the single answer to "can this be submitted?"               */
/* ────────────────────────────────────────────────────────────────────────── */

export interface RegistrationSnapshot {
  /**
   * practisesAsVet: the owner is themselves a veterinarian (a solo practice is
   * common). Their own practitioner licence then satisfies "at least one doctor".
   */
  owner: { claimed: boolean; practisesAsVet?: boolean; licenceNo?: string | null };
  clinic: {
    nameAr?: string | null;
    nameEn?: string | null;
    legalNameAr?: string | null;
    crNumber?: string | null;
    unifiedNumber?: string | null;
    crExpiresAt?: string | Date | null;
  };
  branches: {
    id: string;
    nameAr?: string | null;
    cityCode?: string | null;
    district?: string | null;
    addressLine?: string | null;
    phone?: string | null;
    lat?: number | null;
    lng?: number | null;
    licenceNo?: string | null;
    licenceExpiresAt?: string | Date | null;
  }[];
  documents: { kind: ClinicDocumentKind; branchId?: string | null }[];
  team: { role: VetRole; licenceNo?: string | null }[];
}

export interface RegistrationGap {
  step: RegistrationStep;
  code: string;
  ar: string;
  en: string;
  /** Which branch the gap belongs to, when it is branch-specific. */
  branchId?: string;
}

const blank = (v: unknown) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/**
 * Every reason this registration cannot be submitted yet. Empty = ready.
 * Deliberately returns ALL gaps (not the first), so the review step can list
 * them and link each to its step — never a submit button that just says no.
 */
export function registrationGaps(s: RegistrationSnapshot, now: Date = new Date()): RegistrationGap[] {
  const gaps: RegistrationGap[] = [];
  const push = (g: RegistrationGap) => gaps.push(g);

  if (!s.owner.claimed) {
    push({ step: "account", code: "OWNER_ACCOUNT", ar: "أنشئ حساب المالك.", en: "Create the owner account." });
  }

  const c = s.clinic;
  if (blank(c.nameAr)) push({ step: "clinic", code: "NAME_AR", ar: "اسم العيادة بالعربية مطلوب.", en: "Clinic name in Arabic is required." });
  if (blank(c.nameEn)) push({ step: "clinic", code: "NAME_EN", ar: "اسم العيادة بالإنجليزية مطلوب.", en: "Clinic name in English is required." });
  if (blank(c.legalNameAr)) push({ step: "clinic", code: "LEGAL_NAME", ar: "الاسم النظامي كما في السجل التجاري مطلوب.", en: "Legal name as on the CR is required." });
  if (blank(c.crNumber) || !CR_NUMBER_RE.test(String(c.crNumber))) {
    push({ step: "clinic", code: "CR_NUMBER", ar: "رقم السجل التجاري (١٠ أرقام) مطلوب.", en: "A 10-digit CR number is required." });
  }
  if (blank(c.unifiedNumber) || !UNIFIED_NUMBER_RE.test(String(c.unifiedNumber))) {
    push({ step: "clinic", code: "UNIFIED_NUMBER", ar: "الرقم الوطني الموحد (يبدأ بـ ٧) مطلوب.", en: "The unified national number (starts with 7) is required." });
  }
  if (blank(c.crExpiresAt)) {
    push({ step: "clinic", code: "CR_EXPIRY", ar: "تاريخ انتهاء السجل التجاري مطلوب.", en: "The CR expiry date is required." });
  } else if (new Date(c.crExpiresAt as string).getTime() <= now.getTime()) {
    push({ step: "clinic", code: "CR_EXPIRED", ar: "السجل التجاري منتهي — جدّده أولاً.", en: "The CR has expired — renew it first." });
  }

  if (s.branches.length === 0) {
    push({ step: "branches", code: "NO_BRANCH", ar: "أضف فرعاً واحداً على الأقل.", en: "Add at least one branch." });
  }
  s.branches.forEach((b, i) => {
    const n = i + 1;
    const where = { ar: `الفرع ${n}`, en: `Branch ${n}` };
    const need = (cond: boolean, code: string, ar: string, en: string) => {
      if (cond) push({ step: "branches", code, branchId: b.id, ar: `${where.ar}: ${ar}`, en: `${where.en}: ${en}` });
    };
    need(blank(b.nameAr), "BRANCH_NAME", "الاسم مطلوب.", "name is required.");
    need(blank(b.cityCode), "BRANCH_CITY", "المدينة مطلوبة.", "city is required.");
    need(blank(b.district), "BRANCH_DISTRICT", "الحي مطلوب.", "district is required.");
    need(blank(b.addressLine), "BRANCH_ADDRESS", "العنوان مطلوب.", "street address is required.");
    need(blank(b.phone), "BRANCH_PHONE", "رقم التواصل مطلوب.", "phone is required.");
    need(b.lat == null || b.lng == null, "BRANCH_PIN", "حدّد الموقع على الخريطة.", "drop a pin on the map.");
    need(blank(b.licenceNo), "BRANCH_LICENCE", "رقم ترخيص وزارة البيئة مطلوب.", "MEWA licence number is required.");
    if (blank(b.licenceExpiresAt)) {
      need(true, "BRANCH_LICENCE_EXPIRY", "تاريخ انتهاء الترخيص مطلوب.", "licence expiry date is required.");
    } else {
      need(
        new Date(b.licenceExpiresAt as string).getTime() <= now.getTime(),
        "BRANCH_LICENCE_EXPIRED",
        "الترخيص منتهي.",
        "the licence has expired."
      );
    }
    if (!s.documents.some((d) => d.kind === "MEWA_LICENCE" && d.branchId === b.id)) {
      push({
        step: "documents",
        code: "DOC_MEWA",
        branchId: b.id,
        ar: `${where.ar}: ارفع ترخيص وزارة البيئة.`,
        en: `${where.en}: upload the MEWA licence.`,
      });
    }
  });

  if (!s.documents.some((d) => d.kind === "CR" && !d.branchId)) {
    push({ step: "documents", code: "DOC_CR", ar: "ارفع شهادة السجل التجاري.", en: "Upload the commercial registration certificate." });
  }

  const ownerIsDoctor = !!s.owner.practisesAsVet;
  if (ownerIsDoctor && blank(s.owner.licenceNo)) {
    push({
      step: "team",
      code: "OWNER_LICENCE",
      ar: "بما أنك تمارس المهنة، أدخل رقم ترخيص مزاولة المهنة الخاص بك.",
      en: "Since you practise, enter your own practitioner licence number.",
    });
  }
  if (!ownerIsDoctor && !s.team.some((m) => isDoctorRole(m.role))) {
    push({
      step: "team",
      code: "NO_DOCTOR",
      ar: "أضف طبيباً بيطرياً واحداً على الأقل — أو اختر أنك تمارس المهنة بنفسك.",
      en: "Add at least one veterinarian — or mark that you practise yourself.",
    });
  }
  s.team.forEach((m, i) => {
    if (isDoctorRole(m.role) && blank(m.licenceNo)) {
      push({
        step: "team",
        code: "DOCTOR_LICENCE",
        ar: `عضو الفريق ${i + 1}: رقم ترخيص مزاولة المهنة مطلوب للأطباء.`,
        en: `Team member ${i + 1}: doctors need a practitioner licence number.`,
      });
    }
  });

  return gaps;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Go-live checklist                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export type GoLiveItem = "branches" | "device" | "pins" | "testScan";

export const GO_LIVE_ITEMS: { key: GoLiveItem; ar: string; en: string; hintAr: string; hintEn: string; required: boolean }[] = [
  {
    key: "branches",
    ar: "أكّد بيانات الفروع وأوقات العمل",
    en: "Confirm branch details & hours",
    hintAr: "هذا ما سيراه الأعضاء في دليل العيادات.",
    hintEn: "This is what members will see in the clinic directory.",
    required: true,
  },
  {
    key: "device",
    ar: "سجّل جهاز الاستقبال",
    en: "Register the counter device",
    hintAr: "الجهاز المشترك عند الاستقبال — يعمل بالرمز السري لكل موظف.",
    hintEn: "The shared front-desk device — each person unlocks it with their own PIN.",
    required: true,
  },
  {
    key: "pins",
    ar: "رموز الفريق السرية",
    en: "Team PINs",
    hintAr: "كل من يعمل على جهاز الاستقبال يعيّن رمزه من حسابه.",
    hintEn: "Everyone who uses the counter sets their PIN from their own account.",
    required: false,
  },
  {
    key: "testScan",
    ar: "مسح تجريبي ناجح",
    en: "One successful test scan",
    hintAr: "امسح القطة التجريبية — لا تُفعَّل العيادة بدون مسح ناجح.",
    hintEn: "Scan the demo cat — the clinic can't go live without one successful scan.",
    required: true,
  },
];

/* ────────────────────────────────────────────────────────────────────────── */
/* Terms — the exact words a clinic accepts                                   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface TermsSection {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string[];
  bodyEn: string[];
}

export interface TermsDocument {
  key: "partner-agreement" | "pdpl-addendum" | "staff-confidentiality";
  version: string;
  titleAr: string;
  titleEn: string;
  sections: TermsSection[];
}

/**
 * Bump when ANY word below changes. Stored on every acceptance so an old
 * signature is always read against the text that was actually shown.
 *
 * DRAFT STATUS: written for launch, pending review by Saudi counsel before the
 * first real clinic signs (MRC-VET-002 §Terms).
 */
export const VET_PARTNER_TERMS_VERSION = "2026-09-16";
export const VET_STAFF_CONFIDENTIALITY_VERSION = "2026-09-16";

export const VET_PARTNER_AGREEMENT: TermsDocument = {
  key: "partner-agreement",
  version: VET_PARTNER_TERMS_VERSION,
  titleAr: "اتفاقية شراكة العيادات البيطرية",
  titleEn: "Veterinary Clinic Partner Agreement",
  sections: [
    {
      id: "parties",
      titleAr: "١. الطرفان",
      titleEn: "1. The parties",
      bodyAr: [
        "هذه الاتفاقية بين مؤسسة عبدالرحمن منصور الغامدي التجارية، المشغّلة لمنصة «مرقط» (ويُشار إليها بـ«مرقط»)، والمنشأة البيطرية المسجّلة في هذا الطلب (ويُشار إليها بـ«العيادة»).",
        "يقرّ الشخص الذي يوافق على هذه الاتفاقية بأنه مفوّض نظاماً بإلزام العيادة بها.",
      ],
      bodyEn: [
        "This agreement is between Abdulrahman Mansour Alghamdi Trading Establishment, operator of the Moracat platform (“Moracat”), and the veterinary establishment registered in this application (“the Clinic”).",
        "The person accepting this agreement confirms they are legally authorised to bind the Clinic.",
      ],
    },
    {
      id: "what",
      titleAr: "٢. ما تقدّمه مرقط",
      titleEn: "2. What Moracat provides",
      bodyAr: [
        "بوابة العيادات: التحقق من هوية القطط الأعضاء، السجل الطبي، الزيارات، والظهور في دليل العيادات بعد التوثيق.",
        "لا تدفع مرقط أي مبالغ للعيادة، ولا تتقاضى منها رسوماً، في هذه المرحلة. أي تغيير على ذلك يتطلب اتفاقاً مكتوباً جديداً.",
      ],
      bodyEn: [
        "The partner portal: verifying member cats' identity, medical records, visits, and a listing in the clinic directory once verified.",
        "At this stage Moracat pays the Clinic nothing and charges the Clinic nothing. Any change to that requires a new written agreement.",
      ],
    },
    {
      id: "clinic-duties",
      titleAr: "٣. التزامات العيادة",
      titleEn: "3. The Clinic's obligations",
      bodyAr: [
        "الإبقاء على السجل التجاري وترخيص وزارة البيئة والمياه والزراعة وتراخيص الأطباء سارية، وإبلاغ مرقط خلال ٧ أيام بأي انتهاء أو إيقاف أو تغيير.",
        "صحة كل البيانات والمستندات المقدّمة، وتحديثها عند تغيّرها.",
        "تقديم أي ميزة معلنة لأعضاء مرقط كما هي مكتوبة، دون شروط مخفية.",
        "أن يستخدم كل موظف حسابه الشخصي فقط؛ مشاركة الحسابات ممنوعة.",
      ],
      bodyEn: [
        "Keep the commercial registration, the MEWA veterinary licence and every practitioner's licence valid, and tell Moracat within 7 days of any expiry, suspension or change.",
        "Ensure every detail and document submitted is true, and update it when it changes.",
        "Honour any advertised Moracat member benefit exactly as written, with no hidden conditions.",
        "Every staff member uses only their own account; sharing accounts is not allowed.",
      ],
    },
    {
      id: "records",
      titleAr: "٤. السجلات الطبية والوصول إليها",
      titleEn: "4. Medical records and access",
      bodyAr: [
        "لا يجوز فتح سجل قطة إلا لغرض علاجها أو خدمتها، وضمن مستوى الإذن الذي منحه مالكها.",
        "كل اطلاع على سجل يُسجَّل ويظهر لمالك القطة ولمرقط.",
        "السجلات الطبية لا تُحذف ولا تُعدَّل؛ التصحيح يكون بقيد جديد يُنسب لكاتبه.",
        "الوصول الطارئ للحالات الحرجة فقط، ويُبلَّغ به المالك فوراً.",
      ],
      bodyEn: [
        "A cat's record may only be opened to treat or serve that cat, within the access level its owner granted.",
        "Every record access is logged and visible to the cat's owner and to Moracat.",
        "Medical records are never deleted or edited in place; corrections are new entries attributed to their author.",
        "Emergency access is for genuine emergencies only, and the owner is notified immediately.",
      ],
    },
    {
      id: "clinical",
      titleAr: "٥. المسؤولية الطبية",
      titleEn: "5. Clinical responsibility",
      bodyAr: [
        "مرقط منصة تقنية وليست مقدّم خدمة بيطرية. القرار الطبي ومسؤوليته على العيادة وأطبائها وحدهم.",
        "لا تتحمّل مرقط مسؤولية أي تشخيص أو علاج أو وصفة تقدّمها العيادة.",
      ],
      bodyEn: [
        "Moracat is a technology platform, not a veterinary provider. Clinical decisions, and responsibility for them, rest with the Clinic and its veterinarians alone.",
        "Moracat is not liable for any diagnosis, treatment or prescription the Clinic provides.",
      ],
    },
    {
      id: "brand",
      titleAr: "٦. العلامة والدليل",
      titleEn: "6. Brand and directory",
      bodyAr: [
        "يحق للعيادة استخدام عبارة «شريك مرقط» ومواد العلامة المقدّمة لها فقط طوال مدة الاتفاقية.",
        "تظهر العيادة في دليل مرقط بعد التوثيق وتفعيلها، بالبيانات التي قدّمتها.",
      ],
      bodyEn: [
        "The Clinic may use “Moracat partner” and the brand materials provided to it, and only for the term of this agreement.",
        "The Clinic appears in the Moracat directory once verified and live, using the details it provided.",
      ],
    },
    {
      id: "suspension",
      titleAr: "٧. الإيقاف",
      titleEn: "7. Suspension",
      bodyAr: [
        "يحق لمرقط إيقاف وصول العيادة فوراً عند: انتهاء أو إيقاف ترخيص، أو إساءة استخدام السجلات، أو تقديم بيانات غير صحيحة، أو عدم الالتزام بميزة معلنة للأعضاء.",
        "يُبلَّغ سبب الإيقاف كتابةً، وتبقى السجلات الطبية محفوظة.",
      ],
      bodyEn: [
        "Moracat may suspend the Clinic's access immediately for: an expired or suspended licence, misuse of records, false information, or failing to honour an advertised member benefit.",
        "The reason is given in writing, and medical records are preserved.",
      ],
    },
    {
      id: "term",
      titleAr: "٨. المدة والإنهاء",
      titleEn: "8. Term and exit",
      bodyAr: [
        "مدة الاتفاقية ١٢ شهراً من تاريخ القبول، وتتجدد تلقائياً لمدد مماثلة.",
        "لأي طرف إنهاؤها بإشعار كتابي قبل ٣٠ يوماً. عند الإنهاء تُزال العيادة من الدليل ويُغلق وصولها، وتبقى السجلات الطبية التي كتبتها محفوظة لأصحاب القطط.",
      ],
      bodyEn: [
        "The agreement runs for 12 months from acceptance and renews automatically for equal periods.",
        "Either party may end it with 30 days' written notice. On exit the Clinic leaves the directory and loses access; the medical records it wrote stay available to the cats' owners.",
      ],
    },
    {
      id: "law",
      titleAr: "٩. النظام الحاكم",
      titleEn: "9. Governing law",
      bodyAr: [
        "تخضع هذه الاتفاقية لأنظمة المملكة العربية السعودية، وتختص المحاكم السعودية بأي نزاع. النص العربي هو المعتمد عند الاختلاف.",
      ],
      bodyEn: [
        "This agreement is governed by the laws of the Kingdom of Saudi Arabia, and Saudi courts have jurisdiction over any dispute. The Arabic text prevails in case of difference.",
      ],
    },
  ],
};

export const VET_PDPL_ADDENDUM: TermsDocument = {
  key: "pdpl-addendum",
  version: VET_PARTNER_TERMS_VERSION,
  titleAr: "ملحق حماية البيانات الشخصية",
  titleEn: "Personal Data Protection Addendum",
  sections: [
    {
      id: "roles",
      titleAr: "١. الأدوار",
      titleEn: "1. Roles",
      bodyAr: [
        "وفق نظام حماية البيانات الشخصية: مرقط جهة تحكم ببيانات الأعضاء في المنصة، والعيادة جهة تحكم بما تكتبه من سجلات طبية وبما تجمعه مباشرة من عملائها.",
      ],
      bodyEn: [
        "Under the Personal Data Protection Law (PDPL): Moracat controls member data on the platform; the Clinic controls the medical records it writes and the data it collects directly from its clients.",
      ],
    },
    {
      id: "purpose",
      titleAr: "٢. تحديد الغرض",
      titleEn: "2. Purpose limitation",
      bodyAr: [
        "تستخدم العيادة بيانات الأعضاء (مثل رقم جوال المالك) لخدمة القطة وتواصل الرعاية فقط — لا للتسويق ولا للبيع ولا للمشاركة مع أي طرف.",
      ],
      bodyEn: [
        "The Clinic uses member data (such as the owner's phone number) only to serve the cat and follow up on its care — never for marketing, sale or sharing with anyone else.",
      ],
    },
    {
      id: "confidentiality",
      titleAr: "٣. السرية والموظفون",
      titleEn: "3. Confidentiality and staff",
      bodyAr: [
        "تضمن العيادة أن كل موظف له حساب قد وافق على تعهّد السرية، وتغلق حساب أي موظف يغادر في يوم مغادرته.",
      ],
      bodyEn: [
        "The Clinic ensures every staff member with an account has accepted the confidentiality undertaking, and closes a departing employee's access on the day they leave.",
      ],
    },
    {
      id: "security",
      titleAr: "٤. الأمن والإبلاغ عن الحوادث",
      titleEn: "4. Security and incidents",
      bodyAr: [
        "تحمي العيادة أجهزتها وحساباتها، وتبلّغ مرقط خلال ٢٤ ساعة من علمها بأي وصول غير مصرّح أو فقدان جهاز أو تسرّب، لتتمكن مرقط من الوفاء بالتزامات الإبلاغ النظامية.",
      ],
      bodyEn: [
        "The Clinic protects its devices and accounts, and tells Moracat within 24 hours of learning of any unauthorised access, lost device or leak, so Moracat can meet its legal notification duties.",
      ],
    },
    {
      id: "retention",
      titleAr: "٥. الاحتفاظ والحذف",
      titleEn: "5. Retention and deletion",
      bodyAr: [
        "تحتفظ مرقط بمستندات تسجيل العيادة طوال مدة الشراكة وخمس سنوات بعدها لأغراض التحقق والتدقيق، ثم تحذفها.",
        "لا تنسخ العيادة بيانات الأعضاء خارج المنصة إلا ما يلزم نظاماً لسجلاتها الطبية.",
      ],
      bodyEn: [
        "Moracat keeps the Clinic's registration documents for the partnership and five years after it, for verification and audit, then deletes them.",
        "The Clinic does not copy member data outside the platform except as the law requires for its own medical records.",
      ],
    },
  ],
};

export const VET_STAFF_CONFIDENTIALITY: TermsDocument = {
  key: "staff-confidentiality",
  version: VET_STAFF_CONFIDENTIALITY_VERSION,
  titleAr: "تعهّد السرية",
  titleEn: "Confidentiality undertaking",
  sections: [
    {
      id: "undertaking",
      titleAr: "ما أتعهّد به",
      titleEn: "What I agree to",
      bodyAr: [
        "حسابي لي وحدي — لن أشاركه، ولن أستخدم حساب غيري.",
        "لن أفتح سجل قطة إلا لخدمتها، وأعلم أن كل اطلاع يُسجَّل باسمي ويراه مالكها.",
        "لن أنسخ بيانات الأعضاء أو أشاركها أو أستخدمها لأي غرض آخر، أثناء عملي وبعده.",
        "سأبلّغ مدير العيادة فوراً إذا فقدت جهازاً أو شككت في استخدام حسابي.",
      ],
      bodyEn: [
        "My account is mine alone — I won't share it or use anyone else's.",
        "I only open a cat's record to care for that cat, and I know every access is logged under my name and visible to its owner.",
        "I won't copy, share or use member data for anything else, during my employment or after it.",
        "I'll tell the clinic manager immediately if I lose a device or suspect my account was used.",
      ],
    },
  ],
};

/**
 * The canonical text of a set of documents — the exact bytes the API hashes.
 * Order and separators are part of the contract; do not "tidy" them.
 */
export function canonicalTermsText(docs: TermsDocument[]): string {
  return docs
    .map((d) =>
      [
        `# ${d.key}@${d.version}`,
        d.titleAr,
        d.titleEn,
        ...d.sections.flatMap((s) => [`## ${s.id}`, s.titleAr, ...s.bodyAr, s.titleEn, ...s.bodyEn]),
      ].join("\n")
    )
    .join("\n\n");
}
