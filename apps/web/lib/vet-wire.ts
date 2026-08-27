// ════════════════════════════════════════════════════════════════════════
//  The wire — what the vet API ACTUALLY sends, and the only place that
//  translates it into what the screens read.
//
//  WHY THIS FILE EXISTS
//  Three times now the portal has declared a shape the API has never sent,
//  and three times it reached production before anyone noticed:
//
//    1. `orgId`/`orgNameEn` flat, while auth context sends a nested `org`
//       → every request carried `x-moracat-org: undefined` and the whole
//         portal answered VET_NOT_STAFF. Unreachable from its first call.
//    2. `alerts` as a flat array, while the API sends a grouped object
//       → `.filter is not a function`, the clinical screen to the error
//         boundary, the moment a patient actually had an allergy on file.
//    3. `consentTier` flat, while the API sends `access.tier`
//       → `TIER_COPY[undefined].hiddenAr` threw and took the patient
//         profile down — the single most important screen in the product.
//
//  Each was fixed where it burned. The class was never fixed. So the same
//  drift was still sitting, undetected, in patient search (`scoped`,
//  `detectedType`, `ownerName`), in the emergency payload (`payload.name`
//  under a nested `cat`, `accessId` under `audit`), and in the weight chart
//  (`p.at`/`p.kg` against rows keyed `measuredAt`/`weightKg` — which plots
//  NaN silently rather than crashing, the worst failure of the three).
//
//  The rule from here: `VetWire*` types mirror the server field-for-field
//  and are the ONLY types allowed to describe a response body. Screens read
//  view models. `adapt*()` is the single crossing point, applied inside the
//  fetcher in vet-api.ts, so a screen can no longer disagree with the server
//  — there is nowhere left for it to do so.
//
//  NOTE FOR THE NEXT PERSON: the adapters deliberately return their view model
//  by inference, with NO `as` cast. A cast here would re-open the exact hole
//  this file closes — it would let the adapter and the view model drift apart
//  again while the typecheck stays green, which is how all three bugs above
//  shipped. If TypeScript complains in here, the fix is the mapping, never a
//  cast.
//
//  Everything here is defensive on purpose. A vet portal that renders
//  "undefined" beside a cat's allergies is worse than one that renders
//  nothing, and a chart that plots NaN is worse than both.
// ════════════════════════════════════════════════════════════════════════

import type {
  VetConsentTier,
  VetEmergencyPayload,
  VetMedicalAlert,
  VetPatientProfile,
  VetSearchResponse,
  VetSex,
  VetTier0Alerts,
  VetVaccination,
  VetWeightPoint,
  VetWeightSeriesResponse,
  VetMembershipState,
} from "./vet-api";

/* ────────────────────────────────────────────────────────────────────────────
 * Shared wire primitives
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetWireBilingual {
  ar: string;
  en: string;
}

export interface VetWireClinicRef {
  id?: string;
  ar: string | null;
  en: string | null;
  logoUrl?: string | null;
  isYours?: boolean;
}

/** `VetPatientsService.cardOf()` — the identity block shared by search and profile. */
export interface VetWireCard {
  catId: string;
  catIdNumber: string | null;
  name: string;
  photoUrl: string | null;
  breed: { id: string; ar: string; en: string } | null;
  gender: string;
  birthDate: string | null;
  ageMonths: number | null;
  ageLabel: VetWireBilingual | null;
  weightKg: number | null;
  microchipNo: string | null;
  lifecycleStatus: string;
  membership: {
    status: string;
    label: VetWireBilingual;
    careContinues: boolean;
    counterScript: VetWireBilingual | null;
  };
  owner: {
    displayName: string | null;
    phone: string | null;
    phoneMasked: string;
    locale: string;
  };
}

export interface VetWireClinicRelationship {
  isKnownPatient: boolean;
  visitCountHere: number;
  lastVisitHere: string | null;
  openVisitId?: string | null;
}

export interface VetWireEmergencyContact {
  id: string;
  kind?: string | null;
  name: string;
  phone: string | null;
  relation?: string | null;
  isPrimary: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /vet/patients/:catId
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetWireVaccination {
  id: string;
  /** ONE string. The API does not carry a bilingual vaccine name. */
  name: string;
  administeredAt: string | null;
  dueAt: string | null;
  vetName: string | null;
  clinic: string | null;
  batchNo: string | null;
  overdue: boolean;
}

export interface VetWireWeightRow {
  id: string;
  weightKg: number;
  bcs: number | null;
  measuredAt: string;
  /** Lowercase on the wire ("clinic" | "owner"). */
  source: string;
}

/** Present only at tier ≥ 1. `null` means WITHHELD, never "none on file". */
export interface VetWireCareSummary {
  sterilised: boolean | null;
  lifeStage: string | null;
  isIndoor: boolean | null;
  diet: string | null;
  vaccinationStatus: string | null;
  vaccinations: VetWireVaccination[];
  recentWeights: VetWireWeightRow[];
  activePrescriptions: Array<{
    id: string;
    medication: string;
    dosage: string | null;
    frequency: string | null;
    status: string;
    issuedAt: string;
    clinic: VetWireClinicRef | null;
  }>;
}

export interface VetWireHiddenSection {
  section: string;
  reason: { code: string; ar: string; en: string };
  remedy?: unknown;
}

export interface VetWirePatientProfile extends VetWireCard {
  alerts: VetTier0Alerts;
  emergencyContacts: VetWireEmergencyContact[];
  clinicRelationship: VetWireClinicRelationship;
  /** `null` when the owner's consent tier withholds the care summary. */
  care: VetWireCareSummary | null;
  history: { otherClinics: unknown[] } | null;
  access: {
    tier: VetConsentTier;
    grant: { id: string; tier: string; grantedAt: string; expiresAt: string | null } | null;
    hidden: VetWireHiddenSection[];
    ownRecordsAlwaysVisible: boolean;
    emergencyGrantOnFile: boolean;
    ledgerNotice: VetWireBilingual;
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /vet/patients/search
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetWireSearchResponse {
  query: { raw: string; detectedAs: string; normalized: string | null };
  scope: {
    mode: string;
    /** True when the answer came only from this clinic's own patients. */
    scopedToClinic: boolean;
    notice: VetWireBilingual | null;
  };
  results: Array<VetWireCard & { clinicRelationship: VetWireClinicRelationship; alerts?: VetTier0Alerts }>;
  total: number;
  empty: VetWireBilingual | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * POST /vet/emergency
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetWireEmergencyPayload {
  tier: "T0";
  cat: {
    id: string;
    name: string;
    catIdNumber: string | null;
    photoUrl: string | null;
    gender: string;
    birthDate: string | null;
    weightKg: number | null;
    microchipNo: string | null;
    sterilised: boolean | null;
    breed: { ar: string; en: string } | null;
    membershipStatus: string;
  };
  criticalAlerts: {
    /** BARE STRINGS on the wire — not `{id, allergen}` objects. */
    allergies: string[];
    conditions: Array<{ name: string; notes: string | null }>;
    emergencyNotes: string | null;
    hasCritical: boolean;
    /** "No allergies on file — that is not the same as none." Must be shown. */
    disclaimer: VetWireBilingual | null;
  };
  currentMedications: {
    ownerReported: string | null;
    prescribed: Array<{
      medication: string;
      strength: string | null;
      dosage: string | null;
      frequency: string | null;
      since: string | null;
      clinic: { ar: string | null; en: string | null };
    }>;
  };
  owner: { displayName: string | null; phone: string | null; phoneMasked: string; locale: string };
  emergencyContacts: VetWireEmergencyContact[];
  primaryClinic: {
    id: string;
    ar: string;
    en: string;
    branch: { ar: string; en: string; phone: string | null } | null;
    lastSeenAt: string | null;
  } | null;
  audit: {
    grantId: string;
    at: string;
    reason: string;
    ownerNotified: boolean;
    notice: VetWireBilingual;
  };
  nextStep: { action: string; ar: string; en: string } | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /vet/patients/:catId/timeline  ·  GET /vet/visits/:id
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * `VetPatientsService.presentEntry()`.
 *
 * Note what is NOT here: a title, a body, or an author *name*. The server
 * sends the raw `payload` and expects the reader to render it. The client
 * declared `titleEn/titleAr/bodyEn/bodyAr/authorName/at/kind` — none of which
 * exist — so the timeline drew one "Invalid Date" row per entry, with no
 * heading and no text, for a patient with nine records on file.
 */
export interface VetWireTimelineEntry {
  id: string;
  type: string;
  status: string;
  occurredAt: string;
  createdAt: string;
  /** `null` when the entry was retracted — withheld, never deleted. */
  payload: Record<string, unknown> | null;
  note: string | null;
  retracted: { at: string; reason: string | null; notice?: VetWireBilingual } | null;
  revision?: { isRevisionOf: string | null; supersededBy: string | null; isCurrent: boolean } | null;
  clinic?: VetWireClinicRef | null;
  visit?: { id: string; mode: string; reason: string | null; at: string; state: string } | null;
  author?: { id: string; name: string; role: string; licenceNo: string | null } | null;
  coSignedBy?: { id: string; name: string; role: string } | null;
  coSignedAt?: string | null;
  attachments?: unknown[];
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /vet/patients/:catId/prescriptions
 * ──────────────────────────────────────────────────────────────────────────*/

/** Keys here are `medication`/`dosage`/`issuedAt`; the client read `drugNameEn`/`dose`/`startedAt`. */
export interface VetWirePrescription {
  id: string;
  medication: string;
  strength: string | null;
  form: string | null;
  dosage: string | null;
  frequency: string | null;
  durationDays: number | null;
  quantity: number | null;
  instructions: string | null;
  status: string;
  issuedAt: string;
  collectedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  refills?: { allowed: number; used: number; remaining: number };
  warnings?: unknown;
  entryId: string | null;
  clinic?: VetWireClinicRef | null;
  prescriber?: { id: string; name: string } | null;
  canDispense: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * GET /vet/patients/:catId/weights
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetWireWeightSeries {
  catId: string;
  catName: string;
  currentWeightKg: number | null;
  windowMonths: number;
  series: VetWireWeightRow[];
  trend: { ar: string; en: string; direction?: string; deltaKg?: number } | null;
}

/* ════════════════════════════════════════════════════════════════════════
 *  Adapters
 * ══════════════════════════════════════════════════════════════════════*/

const SEXES: VetSex[] = ["MALE", "FEMALE", "UNKNOWN"];
const MEMBERSHIP_STATES: VetMembershipState[] = ["ACTIVE", "EXPIRED", "SUSPENDED", "PENDING", "NONE"];

function toSex(gender: string | null | undefined): VetSex {
  const g = String(gender ?? "").toUpperCase();
  return (SEXES as string[]).includes(g) ? (g as VetSex) : "UNKNOWN";
}

/**
 * The API's own vocabulary is wider than the badge's (it can say INACTIVE).
 * Anything we don't have a colour for collapses to NONE — but the WORDS still
 * come from the server's bilingual `label`, never from this mapping, so a
 * status we don't recognise is still named correctly on screen (R093).
 */
function toMembershipState(status: string | null | undefined): VetMembershipState {
  const s = String(status ?? "").toUpperCase();
  return (MEMBERSHIP_STATES as string[]).includes(s) ? (s as VetMembershipState) : "NONE";
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return null;
}

/**
 * The profile endpoint pre-computes `ageMonths`; the emergency endpoint sends
 * only `birthDate`. Break-glass showed no age at all because of that gap — and
 * age changes the dose, so it is not cosmetic on this screen of all screens.
 */
function monthsSince(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  const t = born.getTime();
  if (!Number.isFinite(t)) return null;
  const now = new Date();
  const months =
    (now.getFullYear() - born.getFullYear()) * 12 +
    (now.getMonth() - born.getMonth()) -
    (now.getDate() < born.getDate() ? 1 : 0);
  return months >= 0 ? months : null;
}

function adaptVaccination(v: VetWireVaccination): VetVaccination {
  // The record carries one name, so both locales get the same string rather
  // than a fabricated translation. A vaccine name is a proper noun anyway.
  const name = v.name ?? "";
  return {
    id: v.id,
    nameEn: name,
    nameAr: name,
    givenAt: toIso(v.administeredAt),
    dueAt: toIso(v.dueAt),
    administeredBy: v.vetName ?? v.clinic ?? null,
  };
}

function adaptWeightRow(r: VetWireWeightRow): VetWeightPoint {
  return {
    at: toIso(r.measuredAt) ?? "",
    kg: r.weightKg,
    source: String(r.source ?? "").toUpperCase() === "OWNER" ? "OWNER" : "CLINIC",
  };
}

function adaptCard(w: VetWireCard) {
  return {
    catId: w.catId,
    name: w.name,
    catIdNumber: w.catIdNumber ?? "",
    photoUrl: w.photoUrl ?? null,
    breedEn: w.breed?.en ?? null,
    breedAr: w.breed?.ar ?? null,
    sex: toSex(w.gender),
    birthDate: toIso(w.birthDate),
    ageMonths: w.ageMonths ?? null,
    ageLabel: w.ageLabel ?? null,
    weightKg: w.weightKg ?? null,
    microchip: w.microchipNo ?? null,
    membership: {
      state: toMembershipState(w.membership?.status),
      label: w.membership?.label ?? { ar: "", en: "" },
      /** Safety never expires: a lapsed membership changes the price, not the care. */
      careContinues: w.membership?.careContinues ?? true,
      counterScript: w.membership?.counterScript ?? null,
    },
    owner: {
      firstName: w.owner?.displayName ?? null,
      maskedPhone: w.owner?.phoneMasked ?? "",
      phone: w.owner?.phone ?? null,
      locale: w.owner?.locale ?? "ar",
    },
  };
}

/**
 * The patient profile.
 *
 * The one judgement call in here: `care === null` (consent withholds it) and
 * `care.vaccinations === []` (nothing on file) are kept APART, as `null` vs
 * `[]`. Collapsing them is how the profile ended up showing a green
 * "Vaccinations current" badge for a cat whose record the clinic is not
 * allowed to read — a false clinical claim on a screen a vet acts from
 * (R040, principle 6). The badge now has a third state because the data has
 * a third state.
 */
export function adaptPatientProfile(w: VetWirePatientProfile): VetPatientProfile {
  const card = adaptCard(w);
  const contacts = Array.isArray(w.emergencyContacts) ? w.emergencyContacts : [];
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const care = w.care ?? null;

  return {
    ...card,
    owner: {
      ...card.owner,
      emergencyContactName: primary?.name ?? null,
      emergencyContactPhone: primary?.phone ?? null,
    },
    emergencyContacts: contacts,
    sterilised: care?.sterilised ?? null,
    alerts: w.alerts,
    consentTier: w.access?.tier ?? "T0",
    /** Named sections the server says are withheld — shown verbatim, not guessed at. */
    hiddenSections: Array.isArray(w.access?.hidden) ? w.access.hidden : [],
    restrictedByOwner: (w.access?.hidden?.length ?? 0) > 0,
    ledgerNotice: w.access?.ledgerNotice ?? null,
    isOwnPatient: w.clinicRelationship?.isKnownPatient ?? false,
    visitCountHere: w.clinicRelationship?.visitCountHere ?? 0,
    lastVisitAt: toIso(w.clinicRelationship?.lastVisitHere),
    /** `null` = withheld. `[]` = genuinely nothing on file. Never merged. */
    vaccinations: care ? care.vaccinations.map(adaptVaccination) : null,
    weights: care ? care.recentWeights.map(adaptWeightRow) : null,
    careWithheld: care === null,
  };
}

export function adaptSearchResponse(w: VetWireSearchResponse): VetSearchResponse {
  const rows = Array.isArray(w?.results) ? w.results : [];
  return {
    results: rows.map((r) => ({
      catId: r.catId,
      name: r.name,
      catIdNumber: r.catIdNumber ?? "",
      photoUrl: r.photoUrl ?? null,
      ownerName: r.owner?.displayName ?? null,
      lastVisitAt: toIso(r.clinicRelationship?.lastVisitHere),
      isOwnPatient: r.clinicRelationship?.isKnownPatient ?? false,
      openVisitId: r.clinicRelationship?.openVisitId ?? null,
    })),
    scoped: w?.scope?.scopedToClinic ?? false,
    scopeNotice: w?.scope?.notice ?? null,
    detectedType: (w?.query?.detectedAs ?? "name") as VetSearchResponse["detectedType"],
    total: w?.total ?? rows.length,
    empty: w?.empty ?? null,
  };
}

/**
 * Emergency. Two things the client used to throw away, both of which matter
 * more here than anywhere else in the product:
 *
 *  - `criticalAlerts.disclaimer` — "No allergies on file — that is not the
 *    same as none." An empty allergy list in an emergency must never read as
 *    a clearance.
 *  - `audit` — the access id and timestamp that make break-glass accountable.
 *    The screen promises the owner was told; the proof lives in `audit`.
 *
 * Allergies arrive as BARE STRINGS here (unlike the profile's objects), so
 * they are lifted into alert objects with synthetic ids rather than being fed
 * to flattenTier0Alerts, which would emit `labelEn: undefined` for each.
 */
export function adaptEmergencyPayload(w: VetWireEmergencyPayload): VetEmergencyPayload {
  const critical = w?.criticalAlerts;
  const alerts: VetMedicalAlert[] = [];

  for (const [i, allergen] of (critical?.allergies ?? []).entries()) {
    const label = typeof allergen === "string" ? allergen : "";
    if (!label) continue;
    alerts.push({
      id: `emergency-allergy-${i}`,
      kind: "ALLERGY",
      labelEn: label,
      labelAr: label,
      severity: "CRITICAL",
    });
  }
  for (const [i, c] of (critical?.conditions ?? []).entries()) {
    const label = c?.name ?? "";
    if (!label) continue;
    alerts.push({
      id: `emergency-condition-${i}`,
      kind: "CONDITION",
      labelEn: c.notes ? `${label} — ${c.notes}` : label,
      labelAr: c.notes ? `${label} — ${c.notes}` : label,
      severity: "IMPORTANT",
    });
  }
  for (const [i, m] of (w?.currentMedications?.prescribed ?? []).entries()) {
    const dose = [m.dosage, m.frequency].filter(Boolean).join(" · ");
    const label = dose ? `${m.medication} — ${dose}` : m.medication;
    if (!label) continue;
    alerts.push({
      id: `emergency-rx-${i}`,
      kind: "MEDICATION",
      labelEn: label,
      labelAr: label,
      severity: "IMPORTANT",
      notedAt: toIso(m.since),
    });
  }
  const ownerMeds = w?.currentMedications?.ownerReported;
  if (ownerMeds) {
    alerts.push({
      id: "emergency-owner-meds",
      kind: "MEDICATION",
      labelEn: `Owner reports: ${ownerMeds}`,
      labelAr: `المالك ذكر: ${ownerMeds}`,
      severity: "IMPORTANT",
    });
  }
  if (critical?.emergencyNotes) {
    alerts.push({
      id: "emergency-notes",
      kind: "OTHER",
      labelEn: critical.emergencyNotes,
      labelAr: critical.emergencyNotes,
      severity: "IMPORTANT",
    });
  }

  const contacts = Array.isArray(w?.emergencyContacts) ? w.emergencyContacts : [];
  const primary = contacts.find((c) => c.isPrimary) ?? contacts[0] ?? null;
  const birthDate = toIso(w?.cat?.birthDate);

  return {
    catId: w?.cat?.id ?? "",
    name: w?.cat?.name ?? "",
    catIdNumber: w?.cat?.catIdNumber ?? "",
    photoUrl: w?.cat?.photoUrl ?? null,
    sex: toSex(w?.cat?.gender),
    birthDate,
    ageMonths: monthsSince(birthDate),
    weightKg: w?.cat?.weightKg ?? null,
    microchip: w?.cat?.microchipNo ?? null,
    breedEn: w?.cat?.breed?.en ?? null,
    breedAr: w?.cat?.breed?.ar ?? null,
    alerts,
    hasCritical: critical?.hasCritical ?? alerts.some((a) => a.severity === "CRITICAL"),
    /** Absence of a record is not evidence of absence — carried, never dropped. */
    disclaimer: critical?.disclaimer ?? null,
    owner: {
      firstName: w?.owner?.displayName ?? null,
      phone: w?.owner?.phone ?? null,
      maskedPhone: w?.owner?.phoneMasked ?? "",
      emergencyContactName: primary?.name ?? null,
      emergencyContactPhone: primary?.phone ?? null,
    },
    emergencyContacts: contacts,
    primaryClinic: w?.primaryClinic ?? null,
    accessId: w?.audit?.grantId ?? null,
    accessedAt: toIso(w?.audit?.at),
    reason: w?.audit?.reason ?? null,
    ownerNotified: w?.audit?.ownerNotified ?? false,
    auditNotice: w?.audit?.notice ?? null,
    nextStep: w?.nextStep ?? null,
  };
}

/* ════════════════════════════════════════════════════════════════════════
 *  Timeline rendering
 *
 *  The server stores clinical payloads as free JSON, by design: an
 *  append-only record must be able to hold what a vet actually wrote, not
 *  what a form anticipated. That makes rendering the reader's job.
 *
 *  Titles are the SALIENT FACT, not the category — "Rabies", not
 *  "Vaccination"; "5.1 kg", not "Weight". The kind is already shown as a
 *  chip beside it, so repeating it wastes the one line a vet scans.
 *
 *  Clinical text is never machine-translated between ar and en. What the
 *  vet typed is what both locales show; only our own framing words change.
 *  A mistranslated dose is worse than an untranslated one.
 * ══════════════════════════════════════════════════════════════════════*/

/** The one source of truth for entry-kind wording; entry-composer re-exports it. */
export const VET_ENTRY_KIND_LABELS: Record<string, VetWireBilingual> = {
  EXAM: { ar: "فحص", en: "Examination" },
  DIAGNOSIS: { ar: "تشخيص", en: "Diagnosis" },
  VACCINATION: { ar: "تحصين", en: "Vaccination" },
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
  VISIT: { ar: "زيارة", en: "Visit" },
  ATTACHMENT: { ar: "مرفق", en: "Attachment" },
  CONSENT: { ar: "موافقة", en: "Consent" },
};

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

function joinParts(parts: Array<string | null>, sep = " · "): string | null {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(sep) : null;
}

/**
 * Title + body for one entry, derived from its payload.
 *
 * Returns bilingual pairs, but the CLINICAL half of each is identical in both
 * locales on purpose (see the header). Only labels like "Batch"/"دفعة" differ.
 */
function describeEntry(
  type: string,
  payload: Record<string, unknown> | null,
  note: string | null
): { titleAr: string; titleEn: string; bodyAr: string | null; bodyEn: string | null } {
  const kind = VET_ENTRY_KIND_LABELS[type] ?? { ar: type, en: type };
  const p = payload ?? {};

  const fallback = (bodyAr: string | null, bodyEn: string | null) => ({
    titleAr: kind.ar,
    titleEn: kind.en,
    bodyAr: joinParts([bodyAr, note]),
    bodyEn: joinParts([bodyEn, note]),
  });

  switch (type) {
    case "VACCINATION": {
      const vaccine = str(p.vaccine);
      const batch = str(p.batchNo);
      const site = str(p.site);
      if (!vaccine) return fallback(null, null);
      return {
        titleAr: vaccine,
        titleEn: vaccine,
        bodyAr: joinParts([batch ? `دفعة ${batch}` : null, site, note]),
        bodyEn: joinParts([batch ? `Batch ${batch}` : null, site, note]),
      };
    }
    case "WEIGHT": {
      const kg = str(p.weightKg);
      const bcs = str(p.bcs);
      if (!kg) return fallback(null, null);
      return {
        titleAr: `${kg} كجم`,
        titleEn: `${kg} kg`,
        bodyAr: joinParts([bcs ? `درجة السمنة ${bcs}/9` : null, note]),
        bodyEn: joinParts([bcs ? `BCS ${bcs}/9` : null, note]),
      };
    }
    case "DIAGNOSIS": {
      const condition = str(p.condition);
      const status = str(p.status);
      if (!condition) return fallback(null, null);
      return {
        titleAr: condition,
        titleEn: condition,
        bodyAr: joinParts([status, str(p.notes), note]),
        bodyEn: joinParts([status, str(p.notes), note]),
      };
    }
    case "LAB": {
      const panel = str(p.panel);
      const results = Array.isArray(p.results) ? (p.results as Array<Record<string, unknown>>) : [];
      // Abnormal results are the only ones worth the summary line — a vet
      // scanning a timeline needs the flag, not the full panel.
      const flagged = results.filter((r) => {
        const f = String(r.flag ?? "").toLowerCase();
        return f && f !== "normal";
      });
      const detail = flagged
        .map((r) => joinParts([str(r.analyte), str(r.value), str(r.unit)], " "))
        .filter(Boolean)
        .join("، ");
      return {
        titleAr: panel ?? kind.ar,
        titleEn: panel ?? kind.en,
        bodyAr: joinParts([
          flagged.length ? `${flagged.length} نتيجة خارج المدى: ${detail}` : null,
          note,
        ]),
        bodyEn: joinParts([
          flagged.length ? `${flagged.length} out of range: ${detail}` : null,
          note,
        ]),
      };
    }
    case "EXAM": {
      const assessment = str(p.assessment);
      const vitals = joinParts(
        [
          str(p.temperatureC) ? `${str(p.temperatureC)}°C` : null,
          str(p.heartRate) ? `HR ${str(p.heartRate)}` : null,
          str(p.respRate) ? `RR ${str(p.respRate)}` : null,
        ],
        " · "
      );
      return {
        titleAr: assessment ?? kind.ar,
        titleEn: assessment ?? kind.en,
        bodyAr: joinParts([vitals, str(p.plan), note]),
        bodyEn: joinParts([vitals, str(p.plan), note]),
      };
    }
    case "PRESCRIPTION": {
      const med = str(p.medication);
      if (!med) return fallback(null, null);
      return {
        titleAr: med,
        titleEn: med,
        bodyAr: joinParts([str(p.dosage), str(p.frequency), note]),
        bodyEn: joinParts([str(p.dosage), str(p.frequency), note]),
      };
    }
    case "NOTE": {
      const text = str(p.text);
      return {
        titleAr: text ?? kind.ar,
        titleEn: text ?? kind.en,
        bodyAr: text ? note : joinParts([note]),
        bodyEn: text ? note : joinParts([note]),
      };
    }
    default: {
      // Every other kind: lead with whatever names it, then the note.
      const salient =
        str(p.procedure) ?? str(p.name) ?? str(p.title) ?? str(p.description) ?? str(p.summary);
      return {
        titleAr: salient ?? kind.ar,
        titleEn: salient ?? kind.en,
        bodyAr: joinParts([str(p.notes), note]),
        bodyEn: joinParts([str(p.notes), note]),
      };
    }
  }
}

export function adaptTimelineEntry(w: VetWireTimelineEntry) {
  const described = describeEntry(w.type, w.payload, w.note);
  const retracted = w.retracted ?? null;
  return {
    id: w.id,
    kind: w.type as never,
    at: toIso(w.occurredAt) ?? toIso(w.createdAt) ?? "",
    titleEn: described.titleEn,
    titleAr: described.titleAr,
    bodyEn: described.bodyEn,
    bodyAr: described.bodyAr,
    status: w.status as never,
    authorName: w.author?.name ?? "",
    authorRole: (w.author?.role ?? null) as never,
    orgId: w.clinic?.id ?? null,
    orgNameEn: w.clinic?.en ?? null,
    orgNameAr: w.clinic?.ar ?? null,
    revisionOf: w.revision?.isRevisionOf ?? null,
    cosignedBy: w.coSignedBy?.name ?? null,
    cosignedAt: toIso(w.coSignedAt),
    attachments: (Array.isArray(w.attachments) ? w.attachments : []) as never,
    /** Retraction survives the crossing — a withdrawn entry must still show as withdrawn. */
    retracted: retracted
      ? { at: toIso(retracted.at), reason: retracted.reason ?? null, notice: retracted.notice ?? null }
      : null,
  };
}

export function adaptPrescription(w: VetWirePrescription) {
  return {
    id: w.id,
    catId: "",
    drugNameEn: joinParts([w.medication, w.strength], " ") ?? w.medication ?? "",
    drugNameAr: joinParts([w.medication, w.strength], " ") ?? w.medication ?? "",
    dose: w.dosage ?? "",
    frequencyEn: w.frequency ?? "",
    frequencyAr: w.frequency ?? "",
    durationDays: w.durationDays ?? null,
    startedAt: toIso(w.issuedAt) ?? "",
    endsAt: toIso(w.expiresAt),
    status: w.status as never,
    prescribedByName: w.prescriber?.name ?? "",
    // "Dispensed" is the collection event; the server has no dispensedBy field,
    // so the prescriber is NOT quietly substituted for one.
    dispensedByName: null,
    dispensedAt: toIso(w.collectedAt),
    notesEn: w.instructions ?? null,
    notesAr: w.instructions ?? null,
    canDispense: w.canDispense,
    clinic: w.clinic ?? null,
  };
}

/**
 * The weight series. This one never threw — it plotted `NaN` for every point
 * and drew an empty chart, which is precisely why it survived three rounds of
 * fixes. A silent wrong answer outlives a loud one.
 */
export function adaptWeightSeries(w: VetWireWeightSeries): VetWeightSeriesResponse {
  const rows = Array.isArray(w?.series) ? w.series : [];
  return {
    catId: w?.catId ?? "",
    catName: w?.catName ?? "",
    currentWeightKg: w?.currentWeightKg ?? null,
    windowMonths: w?.windowMonths ?? 12,
    series: rows.map(adaptWeightRow).filter((p) => Number.isFinite(p.kg) && !!p.at),
    trend: w?.trend ?? null,
  };
}
