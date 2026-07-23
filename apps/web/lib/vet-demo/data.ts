/**
 * The demo clinic's data — the browser-side stand-in for the whole vet API.
 *
 * WHY THIS EXISTS
 * The vet portal is a real product built against a NestJS API + Postgres. To
 * show it to a prospective clinic "live, any time, online" without a database,
 * a backend to keep warm, or a single real member at risk, the portal can run
 * entirely against this canned clinic. Every shape here mirrors the shared
 * contract in `@moraqat/core` and `lib/vet-api.ts` exactly — the same envelopes
 * the real API sends — so the portal cannot tell the difference.
 *
 * It is a faithful port of `packages/db/prisma/seed-vet-demo.ts`: one LIVE
 * clinic, five staff across every real role, four cats at DIFFERENT consent
 * tiers (so the boundary is demonstrated, not described), and one flagship
 * patient with genuine longitudinal history.
 *
 * SAFETY: every record is obviously fictional. Nothing here touches, reads, or
 * resembles production data — there is no production data in a static demo.
 */

import type { VetRole } from "@moraqat/core";

const DAY = 86_400_000;
const MIN = 60_000;
/** ISO for `days` before now, recomputed per call so "8 minutes ago" stays true. */
export const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();
export const agoMin = (mins: number) => new Date(Date.now() - mins * MIN).toISOString();
export const ahead = (days: number) => new Date(Date.now() + days * DAY).toISOString();

/* ────────────────────────────────────────────────────────────────────────────
 * Credentials — shown on the sign-in screen and accepted by the mock.
 * ──────────────────────────────────────────────────────────────────────────*/

export const DEMO_PASSWORD = "DemoVet!2026";
export const DEMO_PIN = "2468";

/* ────────────────────────────────────────────────────────────────────────────
 * The clinic
 * ──────────────────────────────────────────────────────────────────────────*/

export const ORG = {
  id: "demo-org-alnoor",
  slug: "demo-alnoor-vet",
  nameEn: "Al-Noor Veterinary Clinic (DEMO)",
  nameAr: "عيادة النور البيطرية (تجريبية)",
  city: "Riyadh",
  cityAr: "الرياض",
  crNumber: "1010999001",
};

export const BRANCHES = [
  { id: "demo-branch-main", nameEn: "Al-Noor — Al Olaya", nameAr: "النور — العليا" },
  { id: "demo-branch-north", nameEn: "Al-Noor — Al Nakheel", nameAr: "النور — النخيل" },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Staff — every role a real clinic has. The signed-in identity drives what the
 * portal renders, exactly as the capability matrix does server-side.
 * ──────────────────────────────────────────────────────────────────────────*/

export interface DemoStaff {
  id: string;
  email: string;
  first: string;
  last: string;
  role: VetRole;
  title: string;
  licence?: string;
}

export const STAFF: DemoStaff[] = [
  { id: "demo-staff-owner", email: "demo.owner@moracat.co", first: "Layla", last: "Al-Harbi", role: "OWNER", title: "Clinic owner" },
  { id: "demo-staff-vet-senior", email: "demo.vet@moracat.co", first: "Faisal", last: "Al-Qahtani", role: "VET_SENIOR", title: "Senior veterinarian", licence: "SVC-11482" },
  { id: "demo-staff-vet", email: "demo.vet2@moracat.co", first: "Noura", last: "Al-Dossari", role: "VET", title: "Veterinarian", licence: "SVC-20913" },
  { id: "demo-staff-tech", email: "demo.tech@moracat.co", first: "Omar", last: "Al-Shehri", role: "VET_TECH", title: "Veterinary technician" },
  { id: "demo-staff-reception", email: "demo.reception@moracat.co", first: "Sara", last: "Al-Mutairi", role: "RECEPTION", title: "Front desk" },
];

/** The identity the demo signs in as by default — full clinical authority. */
export const DEFAULT_STAFF_ID = "demo-staff-vet-senior";

export function staffById(id: string | undefined | null): DemoStaff {
  return STAFF.find((s) => s.id === id) ?? STAFF.find((s) => s.id === DEFAULT_STAFF_ID)!;
}
export function staffByEmail(email: string): DemoStaff | undefined {
  const e = email.trim().toLowerCase();
  return STAFF.find((s) => s.email.toLowerCase() === e);
}
export function staffName(s: DemoStaff): string {
  return `${s.title.startsWith("Senior") || s.title.startsWith("Vet") ? "Dr. " : ""}${s.first} ${s.last}`;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Owners & cats — four cats, three owners, four consent tiers.
 * ──────────────────────────────────────────────────────────────────────────*/

export type Tier = "T0" | "T1" | "T2";

export interface DemoCat {
  id: string;
  name: string;
  nameEn: string;
  catIdNumber: string;
  microchip: string;
  sex: "MALE" | "FEMALE" | "UNKNOWN";
  breedEn: string;
  breedAr: string;
  sterilised: boolean;
  birthDaysAgo: number;
  ageMonths: number;
  weightKg: number;
  tier: Tier;
  restrictedByOwner: boolean;
  owner: {
    firstName: string;
    phone: string;
    emergencyContactName?: string | null;
    emergencyContactPhone?: string | null;
  };
  memberSinceDaysAgo: number;
  lastVisitDaysAgo: number | null;
}

export const CATS: DemoCat[] = [
  {
    id: "demo-cat-mishmish",
    name: "مشمش",
    nameEn: "Mishmish",
    catIdNumber: "MRC-7H2K-94QF",
    microchip: "968000011122233",
    sex: "MALE",
    breedEn: "Domestic Shorthair",
    breedAr: "قط منزلي قصير الشعر",
    sterilised: true,
    birthDaysAgo: 1400,
    ageMonths: 46,
    weightKg: 5.1,
    tier: "T2",
    restrictedByOwner: false,
    owner: { firstName: "Hessa", phone: "+966551110001", emergencyContactName: "Abdullah Al-Otaibi", emergencyContactPhone: "+966551110009" },
    memberSinceDaysAgo: 400,
    lastVisitDaysAgo: 0,
  },
  {
    id: "demo-cat-loza",
    name: "لوزة",
    nameEn: "Loza",
    catIdNumber: "MRC-3F8M-21XA",
    microchip: "968000011122234",
    sex: "FEMALE",
    breedEn: "Domestic Shorthair",
    breedAr: "قط منزلي قصير الشعر",
    sterilised: true,
    birthDaysAgo: 900,
    ageMonths: 29,
    weightKg: 4.2,
    tier: "T1",
    restrictedByOwner: false,
    owner: { firstName: "Hessa", phone: "+966551110001" },
    memberSinceDaysAgo: 400,
    lastVisitDaysAgo: 120,
  },
  {
    id: "demo-cat-simsim",
    name: "سمسم",
    nameEn: "Simsim",
    catIdNumber: "MRC-9K4P-55RT",
    microchip: "968000011122235",
    sex: "MALE",
    breedEn: "Domestic Shorthair",
    breedAr: "قط منزلي قصير الشعر",
    sterilised: true,
    birthDaysAgo: 900,
    ageMonths: 29,
    weightKg: 4.4,
    tier: "T1",
    restrictedByOwner: true,
    owner: { firstName: "Abdulaziz", phone: "+966551110002" },
    memberSinceDaysAgo: 210,
    lastVisitDaysAgo: null,
  },
  {
    id: "demo-cat-basbas",
    name: "بسبس",
    nameEn: "Basbas",
    catIdNumber: "MRC-2M6N-08LB",
    microchip: "968000011122236",
    sex: "UNKNOWN",
    breedEn: "Domestic Shorthair",
    breedAr: "قط منزلي قصير الشعر",
    sterilised: true,
    birthDaysAgo: 700,
    ageMonths: 23,
    weightKg: 3.9,
    tier: "T0",
    restrictedByOwner: false,
    owner: { firstName: "Reem", phone: "+966551110003" },
    memberSinceDaysAgo: 90,
    lastVisitDaysAgo: null,
  },
];

export function catById(id: string): DemoCat | undefined {
  return CATS.find((c) => c.id === id);
}

/** Mask a phone the way the API does: keep the last three digits. */
export function maskPhone(phone: string): string {
  const tail = phone.slice(-3);
  return `+966 5•• ••• •${tail}`;
}

const CLINIC_REF = { id: ORG.id, ar: ORG.nameAr, en: ORG.nameEn, logoUrl: null as string | null, isYours: true };

/* ────────────────────────────────────────────────────────────────────────────
 * Tier-0 safety data — grouped exactly as the API sends it. Always returned,
 * at every tier, because a hidden allergy can kill (the whole point of the
 * boundary demo).
 * ──────────────────────────────────────────────────────────────────────────*/

export function tier0Alerts(catId: string) {
  switch (catId) {
    case "demo-cat-mishmish":
      return {
        allergies: [{ id: "al-mishmish-1", allergen: "Chicken protein", severity: "critical", notedAt: ago(210) }],
        conditions: [{ id: "cd-mishmish-1", condition: "Food-responsive dermatitis", notedAt: ago(150) }],
        currentMedications: {
          ownerReported: null as string | null,
          prescribed: [
            {
              id: "rx-mishmish-1",
              medication: "Hypoallergenic diet (hydrolysed)",
              dosage: "60 g",
              frequency: "twice daily",
              status: "ISSUED",
              issuedAt: ago(30),
              expiresAt: null as string | null,
              clinic: CLINIC_REF,
            },
          ],
        },
        handlingNotes: [] as Array<{ id?: string; note?: string } | string>,
        emergencyNotes: null as string | null,
        vaccinationStatus: "current" as string | null,
        hasCritical: true,
      };
    case "demo-cat-loza":
      return {
        allergies: [],
        conditions: [],
        currentMedications: { ownerReported: null, prescribed: [] },
        handlingNotes: [{ id: "hn-loza-1", note: "Nervous at the clinic — approach slowly, towel-wrap for handling." }],
        emergencyNotes: null,
        vaccinationStatus: "current",
        hasCritical: false,
      };
    case "demo-cat-simsim":
      return {
        allergies: [],
        conditions: [],
        currentMedications: { ownerReported: null, prescribed: [] },
        handlingNotes: [],
        emergencyNotes: null,
        vaccinationStatus: "unknown",
        hasCritical: false,
      };
    case "demo-cat-basbas":
      // Deliberately a T0 cat that still carries life-critical tier-0 data —
      // the single most important thing to show a vet: consent never hides
      // what can kill.
      return {
        allergies: [{ id: "al-basbas-1", allergen: "Penicillin (owner-reported)", severity: "critical", notedAt: null }],
        conditions: [],
        currentMedications: { ownerReported: "Owner reports an occasional antihistamine at home", prescribed: [] },
        handlingNotes: [],
        emergencyNotes: null,
        vaccinationStatus: "unknown",
        hasCritical: true,
      };
    default:
      return {
        allergies: [],
        conditions: [],
        currentMedications: { ownerReported: null, prescribed: [] },
        handlingNotes: [],
        emergencyNotes: null,
        vaccinationStatus: "unknown",
        hasCritical: false,
      };
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Vaccinations (part of the profile). Withheld at T0 — that IS the boundary.
 * ──────────────────────────────────────────────────────────────────────────*/

export function vaccinations(cat: DemoCat) {
  if (cat.tier === "T0") return [];
  if (cat.id === "demo-cat-mishmish") {
    return [
      { id: "vx-mishmish-1", nameEn: "Feline Tricat (FVRCP)", nameAr: "التطعيم الثلاثي (FVRCP)", givenAt: ago(210), dueAt: ahead(160), administeredBy: ORG.nameEn },
      { id: "vx-mishmish-2", nameEn: "Rabies", nameAr: "السعار", givenAt: ago(210), dueAt: ahead(20), administeredBy: ORG.nameEn },
    ];
  }
  if (cat.id === "demo-cat-loza") {
    return [
      { id: "vx-loza-1", nameEn: "Feline Tricat (FVRCP)", nameAr: "التطعيم الثلاثي (FVRCP)", givenAt: ago(120), dueAt: ahead(245), administeredBy: ORG.nameEn },
    ];
  }
  // Simsim: a cat the clinic knows but has no vaccination record for — shown as
  // "no record", never "unvaccinated" (R006).
  return [];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Weight series (charts). T2 only — the flagship's real four-point trend.
 * ──────────────────────────────────────────────────────────────────────────*/

export function weightSeries(cat: DemoCat) {
  if (cat.id !== "demo-cat-mishmish") {
    if (cat.tier === "T0") return [];
    // A single owner-reported point for the T1 cats — enough to show provenance.
    return [{ at: ago(cat.lastVisitDaysAgo ?? 120), kg: cat.weightKg, source: "CLINIC" as const }];
  }
  return [
    { at: ago(210), kg: 4.6, source: "CLINIC" as const },
    { at: ago(150), kg: 4.8, source: "CLINIC" as const },
    { at: ago(90), kg: 5.0, source: "OWNER" as const },
    { at: ago(30), kg: 5.1, source: "CLINIC" as const },
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Prescriptions. T2 flagship only.
 * ──────────────────────────────────────────────────────────────────────────*/

export function basePrescriptions(cat: DemoCat) {
  if (cat.id !== "demo-cat-mishmish") return [];
  return [
    {
      id: "rx-mishmish-1",
      catId: cat.id,
      drugNameEn: "Hypoallergenic diet (hydrolysed)",
      drugNameAr: "حمية مضادة للحساسية (مُحلّلة)",
      dose: "60 g",
      frequencyEn: "twice daily",
      frequencyAr: "مرتين يومياً",
      durationDays: 56,
      startedAt: ago(30),
      endsAt: null as string | null,
      status: "ISSUED",
      prescribedByName: "Dr. Noura Al-Dossari",
      dispensedByName: null as string | null,
      dispensedAt: null as string | null,
      notesEn: "Strict — no treats containing poultry.",
      notesAr: "التزام تام — بدون مكافآت تحتوي دواجن.",
    },
  ];
}

/* ────────────────────────────────────────────────────────────────────────────
 * The flagship's clinical timeline. Cross-clinic rows would be hidden below T2;
 * here every row is this clinic's own, so consent never removes them.
 * ──────────────────────────────────────────────────────────────────────────*/

export function baseTimeline(cat: DemoCat) {
  const org = { orgId: ORG.id, orgNameEn: ORG.nameEn, orgNameAr: ORG.nameAr };
  const final = { status: "FINAL" as const };

  if (cat.id === "demo-cat-mishmish") {
    return [
      {
        id: "tl-mishmish-visit", kind: "VISIT", at: ago(210), ...final,
        titleEn: "Visit — annual check-up + booster", titleAr: "زيارة — الفحص السنوي والجرعة المنشّطة",
        bodyEn: "Routine; owner reports mild scratching.", bodyAr: "روتيني؛ المالكة تذكر حكة خفيفة.",
        authorName: "Dr. Faisal Al-Qahtani", authorRole: "Senior veterinarian", ...org,
      },
      {
        id: "tl-mishmish-exam", kind: "EXAM", at: ago(210), ...final,
        titleEn: "Examination", titleAr: "فحص سريري",
        bodyEn: "S: Bright, alert, eating normally. Mild pruritus reported.\nO: BCS 5/9. Coat good. Mild erythema ventral abdomen. Teeth grade 1 tartar. T 38.6°C, HR 180, RR 28.\nA: Healthy adult. Suspect mild food-responsive dermatitis.\nP: Booster today. Trial hydrolysed diet 8 weeks. Recheck if worsening.",
        bodyAr: "ذاتي: نشيط، يقظ، يأكل طبيعياً. حكة خفيفة.\nموضوعي: الحالة الجسمية ٥/٩. الفرو جيد. احمرار خفيف أسفل البطن. جير أسنان درجة ١. الحرارة ٣٨٫٦، النبض ١٨٠، التنفس ٢٨.\nالتقييم: بالغ سليم. يُشتبه بالتهاب جلد مرتبط بالغذاء.\nالخطة: جرعة منشّطة اليوم. حمية محلّلة ٨ أسابيع. مراجعة عند التدهور.",
        authorName: "Dr. Faisal Al-Qahtani", authorRole: "Senior veterinarian", ...org,
      },
      {
        id: "tl-mishmish-vax1", kind: "VACCINATION", at: ago(210), ...final,
        titleEn: "Feline Tricat (FVRCP)", titleAr: "التطعيم الثلاثي (FVRCP)",
        bodyEn: "Batch TRC-2451-B · MSD · left shoulder, SC. No immediate reaction over 15 min.",
        bodyAr: "التشغيلة TRC-2451-B · MSD · الكتف الأيسر، تحت الجلد. لا تفاعل خلال ١٥ دقيقة.",
        authorName: "Dr. Faisal Al-Qahtani", authorRole: "Senior veterinarian", ...org,
      },
      {
        id: "tl-mishmish-vax2", kind: "VACCINATION", at: ago(210), ...final,
        titleEn: "Rabies", titleAr: "السعار",
        bodyEn: "Batch RAB-8890-C · Boehringer · right hind limb, SC.",
        bodyAr: "التشغيلة RAB-8890-C · Boehringer · الطرف الخلفي الأيمن، تحت الجلد.",
        authorName: "Dr. Faisal Al-Qahtani", authorRole: "Senior veterinarian", ...org,
      },
      {
        id: "tl-mishmish-lab", kind: "LAB", at: ago(150), ...final,
        titleEn: "Biochemistry + CBC", titleAr: "كيمياء حيوية + صورة دم كاملة",
        bodyEn: "Creatinine 1.3 mg/dL (normal). ALT 61 U/L (normal). Eosinophils 1.4 ×10³/µL (HIGH). Eosinophilia consistent with the dermatitis picture.",
        bodyAr: "الكرياتينين ١٫٣ (طبيعي). ALT ٦١ (طبيعي). الحمضات ١٫٤ (مرتفع). كثرة الحمضات تتوافق مع صورة التهاب الجلد.",
        authorName: "Dr. Noura Al-Dossari", authorRole: "Veterinarian", ...org,
      },
      {
        id: "tl-mishmish-dx", kind: "DIAGNOSIS", at: ago(150), ...final,
        titleEn: "Food-responsive dermatitis (chronic)", titleAr: "التهاب جلد مرتبط بالغذاء (مزمن)",
        bodyEn: "Confirmed by dietary elimination and rechallenge. Responds well to hydrolysed diet; flares when owner reintroduces chicken.",
        bodyAr: "مؤكَّد بالحمية الإقصائية وإعادة التحدي. يستجيب جيداً للحمية المحلّلة؛ يشتد عند إعادة الدجاج.",
        authorName: "Dr. Noura Al-Dossari", authorRole: "Veterinarian", ...org,
      },
      {
        id: "tl-mishmish-wt", kind: "WEIGHT", at: ago(30), ...final,
        titleEn: "Weight 5.1 kg", titleAr: "الوزن ٥٫١ كجم",
        bodyEn: "BCS 5/9. Clinic-measured.", bodyAr: "الحالة الجسمية ٥/٩. قياس عيادة.",
        authorName: "Omar Al-Shehri", authorRole: "Veterinary technician", ...org,
      },
      {
        id: "tl-mishmish-rx", kind: "PRESCRIPTION", at: ago(30), ...final,
        titleEn: "Hypoallergenic diet (hydrolysed)", titleAr: "حمية مضادة للحساسية (مُحلّلة)",
        bodyEn: "60 g twice daily × 56 days. Strict — no treats containing poultry.",
        bodyAr: "٦٠ جم مرتين يومياً لمدة ٥٦ يوماً. التزام تام — بدون مكافآت تحتوي دواجن.",
        authorName: "Dr. Noura Al-Dossari", authorRole: "Veterinarian", ...org,
      },
    ];
  }

  if (cat.id === "demo-cat-loza") {
    return [
      {
        id: "tl-loza-vax1", kind: "VACCINATION", at: ago(120), ...final,
        titleEn: "Feline Tricat (FVRCP)", titleAr: "التطعيم الثلاثي (FVRCP)",
        bodyEn: "Annual booster. No reaction observed.", bodyAr: "جرعة سنوية منشّطة. لا تفاعل ملحوظ.",
        authorName: "Dr. Noura Al-Dossari", authorRole: "Veterinarian", ...org,
      },
      {
        id: "tl-loza-note", kind: "NOTE", at: ago(120), ...final,
        titleEn: "Handling note", titleAr: "ملاحظة تعامل",
        bodyEn: "Nervous at the clinic — approach slowly, towel-wrap for handling.",
        bodyAr: "متوترة في العيادة — اقترب ببطء، لفّها بمنشفة عند التعامل.",
        authorName: "Omar Al-Shehri", authorRole: "Veterinary technician", ...org,
      },
    ];
  }

  // Simsim & Basbas: known to the clinic, but no clinical history written yet.
  return [];
}

/* ────────────────────────────────────────────────────────────────────────────
 * Access ledger — the owner's proof of who looked. Bilateral trust (P3).
 * ──────────────────────────────────────────────────────────────────────────*/

export function accessLog(catId?: string) {
  const rows = [
    { id: "log-1", at: ago(210), actorName: "Dr. Faisal Al-Qahtani", actorRole: "VET_SENIOR" as VetRole, action: "PROFILE_VIEW" as const, catId: "demo-cat-mishmish", catName: "مشمش", branchId: "demo-branch-main", counterMode: false },
    { id: "log-2", at: ago(210), actorName: "Dr. Faisal Al-Qahtani", actorRole: "VET_SENIOR" as VetRole, action: "RECORD_WRITE" as const, catId: "demo-cat-mishmish", catName: "مشمش", branchId: "demo-branch-main", counterMode: false },
    { id: "log-3", at: ago(150), actorName: "Dr. Noura Al-Dossari", actorRole: "VET" as VetRole, action: "RECORD_READ" as const, catId: "demo-cat-mishmish", catName: "مشمش", branchId: "demo-branch-main", counterMode: false },
    { id: "log-4", at: agoMin(8), actorName: "Sara Al-Mutairi", actorRole: "RECEPTION" as VetRole, action: "SEARCH" as const, catId: "demo-cat-mishmish", catName: "مشمش", branchId: "demo-branch-main", counterMode: true },
  ];
  return catId ? rows.filter((r) => r.catId === catId) : rows;
}
