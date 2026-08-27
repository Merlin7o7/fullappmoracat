/**
 * Moracat Vet Portal — the shared client (MRC-VET-001).
 *
 * One file, three jobs:
 *   1. Every TypeScript shape the portal exchanges with the API.
 *   2. `useVetActor()` — who is acting, in which clinic, with what capabilities.
 *   3. Typed fetchers that always carry the `x-moracat-org` header.
 *
 * Why it is centralised: the portal is org-scoped in a way the member app never
 * is. The same person may be a VET at one clinic and an OWNER at their own, and
 * every single call must say which clinic it is speaking for. Threading that
 * header by hand through screens is how a patient record eventually leaks into
 * the wrong clinic — so the header is not optional here, it is structural.
 *
 * Capability rendering uses `@moraqat/core` (`can`, `capabilitiesFor`), the same
 * pure function the API guard uses. The UI never invents its own permission
 * logic: a receptionist doesn't see a disabled "write record" button, she never
 * sees it at all (dossier §14 — permission-aware IA, not greyed-out noise).
 */

"use client";

import * as React from "react";
import {
  can as coreCan,
  capabilitiesFor,
  assertShape,
  type VetCapability,
  type VetRole,
  type Paginated,
  type RecordList,
  type VisitState as CoreVisitState,
  type PrescriptionStatus as CorePrescriptionStatus,
} from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { ApiError, fetchWithTimeout, httpError } from "@/lib/http";
import { friendlyError, type FriendlyError } from "@/lib/errors";
import {
  adaptEmergencyPayload,
  adaptPatientProfile,
  adaptPrescription,
  adaptSearchResponse,
  adaptTimelineEntry,
  adaptWeightSeries,
  type VetWireEmergencyPayload,
  type VetWirePatientProfile,
  type VetWirePrescription,
  type VetWireSearchResponse,
  type VetWireTimelineEntry,
  type VetWireWeightSeries,
} from "@/lib/vet-wire";

export type { VetCapability, VetRole };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const ORG_STORAGE_KEY = "moraqat.vet.org";
const BRANCH_STORAGE_KEY = "moraqat.vet.branch";
const DEVICE_STORAGE_KEY = "moraqat.vet.device";
const RECENTS_STORAGE_KEY = "moraqat.vet.recents";
/** Device-local lookup memory is deliberately short-lived (dossier §05). */
const RECENTS_TTL_MS = 24 * 60 * 60 * 1000;
const RECENTS_MAX = 10;

/* ────────────────────────────────────────────────────────────────────────────
 * Org, membership, actor
 * ──────────────────────────────────────────────────────────────────────────*/

/** Partner lifecycle (dossier §01). Only LIVE clinics serve a counter. */
export type VetOrgStatus =
  | "APPLIED"
  | "IN_REVIEW"
  | "APPROVED"
  | "SIGNED"
  | "ONBOARDING"
  | "LIVE"
  | "PAUSED"
  | "SUSPENDED"
  | "OFFBOARDED";

export type VetMembershipStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "OFFBOARDED";

export interface VetBranch {
  id: string;
  nameEn: string;
  nameAr: string;
}

/** The clinic itself, as the auth context returns it. */
export interface VetMembershipOrg {
  id: string;
  slug: string;
  nameEn: string;
  nameAr: string;
  logoUrl: string | null;
  status: VetOrgStatus;
  verified: boolean;
  suspended: boolean;
}

/**
 * One person's standing inside one clinic. The unit of authorisation.
 *
 * The clinic arrives NESTED under `org`. The portal previously declared flat
 * `orgId` / `orgNameEn` / `orgNameAr` fields that the API has never sent, so
 * `orgId` was always undefined — every subsequent call went out with
 * `x-moracat-org: undefined` and came back VET_NOT_STAFF. The entire clinic
 * portal was unreachable from its very first request, and because the fetch
 * helper cast without validating, it surfaced as empty screens rather than an
 * error.
 */
export interface VetMembership {
  staffId: string;
  org: VetMembershipOrg;
  role: VetRole;
  roleLabel?: { ar: string; en: string };
  status: VetMembershipStatus;
  title?: string | null;
  joinedAt?: string | null;
  hasCounterPin?: boolean;
  branches: VetBranch[];
  capabilities?: VetCapability[];
}

export interface VetAuthContext {
  memberships: VetMembership[];
}

export interface VetCounterUnlockInput {
  deviceId: string;
  staffId: string;
  pin: string;
}

export interface VetCounterSession {
  /** The identity now driving the shared terminal. */
  staffId: string;
  staffName: string;
  role: VetRole;
  orgId: string;
  deviceId: string;
  deviceName?: string;
  /** ISO — the terminal re-locks itself at this moment (dossier §02: 2 min idle). */
  expiresAt?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Finding a cat
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * What the omnibox decided the typed/scanned input was.
 *
 * The first five are the API contract. `email` is a client-side extension the
 * detector can produce ahead of the round-trip (dossier §05 lists owner email);
 * treat it like `name` when branching, and always keep a `default` arm.
 */
export type VetDetectedType = "catId" | "qr" | "microchip" | "phone" | "name" | "email";

export interface VetSearchResult {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  ownerName?: string | null;
  lastVisitAt?: string | null;
  /** True when this clinic has treated the cat before — the consented relationship. */
  isOwnPatient: boolean;
  /** Set when this cat is mid-visit here, so the row can resume it. */
  openVisitId?: string | null;
}

/**
 * VIEW MODEL — produced by `adaptSearchResponse`, not the wire shape.
 * The server sends `{query:{detectedAs}, scope:{scopedToClinic, notice}, …}`
 * and each row nests owner/relationship. See lib/vet-wire.ts.
 */
export interface VetSearchResponse {
  results: VetSearchResult[];
  /**
   * True when the query was answered only from this clinic's own patients —
   * the privacy boundary (dossier §05). The UI must say so out loud.
   */
  scoped: boolean;
  /** The server's own words for the boundary — preferred over local copy. */
  scopeNotice?: { ar: string; en: string } | null;
  detectedType: VetDetectedType;
  total?: number;
  empty?: { ar: string; en: string } | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The patient
 * ──────────────────────────────────────────────────────────────────────────*/

export type VetConsentTier = "T0" | "T1" | "T2";
export type VetSex = "MALE" | "FEMALE" | "UNKNOWN";

export type VetAlertKind = "ALLERGY" | "CONDITION" | "MEDICATION" | "BEHAVIOUR" | "OTHER";

/** A hidden allergy can kill — alerts live in tier 0 and are never collapsed. */
export interface VetMedicalAlert {
  id: string;
  kind: VetAlertKind;
  labelEn: string;
  labelAr: string;
  severity: "CRITICAL" | "IMPORTANT" | "INFO";
  notedAt?: string | null;
}

/**
 * Tier-0 safety data, exactly as the API groups it.
 *
 * The portal declared this as a flat `VetMedicalAlert[]` and called `.filter`
 * on it. The API has always sent a GROUPED OBJECT, so `alerts ?? []` never
 * helped — the object is not null, it simply has no `.filter` — and the whole
 * visit screen crashed to the error boundary the moment a patient actually had
 * an allergy on file. It only surfaced once real demo data existed, because an
 * empty clinic never reached this code.
 */
export interface VetTier0Alerts {
  allergies: Array<{ id: string; allergen: string; severity?: string | null; notedAt?: string | null }>;
  conditions: Array<{ id: string; condition?: string; name?: string; notedAt?: string | null }>;
  currentMedications: {
    ownerReported: string | null;
    prescribed: Array<{
      id: string;
      medication: string;
      strength?: string | null;
      dosage?: string | null;
      frequency?: string | null;
      status?: string;
      issuedAt?: string;
      expiresAt?: string | null;
      clinic?: { id: string; ar: string; en: string; logoUrl: string | null; isYours: boolean };
    }>;
  };
  /**
   * The server sends `{id, text, at, clinic}`. `note` was the only key read
   * here, so every handling note — "hates carriers", "bites when scruffed" —
   * was silently dropped from the safety band. Both keys are accepted now.
   */
  handlingNotes: Array<{ id?: string; note?: string; text?: string; at?: string | null } | string>;
  emergencyNotes: string | null;
  vaccinationStatus: string | null;
  /** True when anything in here is life-threatening. Drives the solid-fill band. */
  hasCritical: boolean;
}

/**
 * Flatten the grouped tier-0 payload into the display list the alerts band
 * renders. Kept here, beside the type, so every screen showing alerts gets the
 * same ordering and severity rules rather than each inventing them.
 */
export function flattenTier0Alerts(
  alerts: VetTier0Alerts | VetMedicalAlert[] | null | undefined
): VetMedicalAlert[] {
  // Tolerate an already-flat array so a future API change cannot re-break this.
  if (Array.isArray(alerts)) return alerts;
  if (!alerts) return [];

  const out: VetMedicalAlert[] = [];

  for (const a of alerts.allergies ?? []) {
    out.push({
      id: a.id,
      kind: "ALLERGY",
      labelEn: a.allergen,
      labelAr: a.allergen,
      // An allergy is life-threatening until someone says otherwise.
      severity: "CRITICAL",
      notedAt: a.notedAt ?? null,
    });
  }

  for (const c of alerts.conditions ?? []) {
    const label = c.condition ?? c.name ?? "";
    if (!label) continue;
    out.push({ id: c.id, kind: "CONDITION", labelEn: label, labelAr: label, severity: "IMPORTANT", notedAt: c.notedAt ?? null });
  }

  for (const m of alerts.currentMedications?.prescribed ?? []) {
    const dose = [m.dosage, m.frequency].filter(Boolean).join(" · ");
    const label = dose ? `${m.medication} — ${dose}` : m.medication;
    out.push({ id: m.id, kind: "MEDICATION", labelEn: label, labelAr: label, severity: "IMPORTANT", notedAt: m.issuedAt ?? null });
  }

  const ownerMeds = alerts.currentMedications?.ownerReported;
  if (ownerMeds) {
    out.push({
      id: "owner-reported-meds",
      kind: "MEDICATION",
      labelEn: `Owner reports: ${ownerMeds}`,
      labelAr: `المالك ذكر: ${ownerMeds}`,
      severity: "IMPORTANT",
    });
  }

  for (const [i, h] of (alerts.handlingNotes ?? []).entries()) {
    // `text` is what the server actually sends; `note` is kept so an older
    // shape (or a future rename back) cannot silence a handling warning.
    const label = typeof h === "string" ? h : (h.text ?? h.note ?? "");
    if (!label) continue;
    out.push({
      id: (typeof h === "string" ? undefined : h.id) ?? `handling-${i}`,
      kind: "BEHAVIOUR",
      labelEn: label,
      labelAr: label,
      severity: "INFO",
      notedAt: typeof h === "string" ? null : (h.at ?? null),
    });
  }

  if (alerts.emergencyNotes) {
    out.push({
      id: "emergency-notes",
      kind: "OTHER",
      labelEn: alerts.emergencyNotes,
      labelAr: alerts.emergencyNotes,
      severity: "IMPORTANT",
    });
  }

  return out;
}

export type VetMembershipState = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING" | "NONE";

/**
 * The five-second answer: does this membership stand?
 *
 * `memberSince`, `benefitLabel*`, `discountPercent`, `verifiedAt` and `offline`
 * used to be declared here. The patient endpoint has never sent any of them —
 * the Hero rendered a benefit badge and a "member since" line from four fields
 * that were permanently `undefined`. They are gone rather than faked: the
 * profile API carries standing, not entitlements.
 */
export interface VetMembershipStanding {
  state: VetMembershipState;
  /** The server's bilingual wording. Status is never colour alone (R093). */
  label: { ar: string; en: string };
  /** Safety never expires: a lapsed membership changes the price, not the care. */
  careContinues: boolean;
  /** What to say at the counter when standing is anything but ordinary. */
  counterScript?: { ar: string; en: string } | null;
}

export interface VetOwnerContact {
  /** Server-composed display name. `null` until the tier reveals owner identity. */
  firstName: string | null;
  /** Masked by default; the full number is a deliberate, logged reveal. */
  maskedPhone: string;
  phone?: string | null;
  locale?: string;
  /** Lifted from the profile's `emergencyContacts[]` — the primary one. */
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}

export interface VetVaccination {
  id: string;
  nameEn: string;
  nameAr: string;
  givenAt: string | null;
  dueAt: string | null;
  /** Clinic that administered it, when the owner's consent tier reveals it. */
  administeredBy?: string | null;
}

export interface VetWeightPoint {
  at: string;
  kg: number;
  /** Who recorded it — a clinic reading and an owner reading are not the same. */
  source: "CLINIC" | "OWNER";
}

/**
 * VIEW MODEL — produced by `adaptPatientProfile` (lib/vet-wire.ts), never the
 * raw response. The server nests identity under `cardOf`, care under `care`,
 * consent under `access` and the relationship under `clinicRelationship`.
 *
 * The important field here is `vaccinations`, and its important value is
 * `null`:
 *
 *   null  → the owner's consent tier WITHHOLDS the care summary. Unknown.
 *   []    → the clinic can see the record and there is nothing on file.
 *   [...] → doses on file.
 *
 * Those first two must never collapse together. When they did, a cat whose
 * record this clinic may not read still showed a green "Vaccinations current"
 * badge — a clinical claim the data does not support (R040, principle 6).
 */
export interface VetPatientProfile {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  breedEn?: string | null;
  breedAr?: string | null;
  sex: VetSex;
  /** Part of the care summary — `null` when withheld, as well as when unknown. */
  sterilised: boolean | null;
  birthDate?: string | null;
  ageMonths?: number | null;
  /** The server's pre-composed bilingual age ("3 yr 11 mo"). */
  ageLabel?: { ar: string; en: string } | null;
  weightKg?: number | null;
  microchip?: string | null;
  membership: VetMembershipStanding;
  owner: VetOwnerContact;
  emergencyContacts: Array<{
    id: string;
    kind?: string | null;
    name: string;
    phone: string | null;
    relation?: string | null;
    isPrimary: boolean;
  }>;
  /** GROUPED, not a flat array — flatten with flattenTier0Alerts() to display. */
  alerts: VetTier0Alerts;
  /** The tier this clinic currently holds for this cat. */
  consentTier: VetConsentTier;
  /** The sections the server says are withheld, in its own bilingual words. */
  hiddenSections: Array<{
    section: string;
    reason: { code: string; ar: string; en: string };
    remedy?: unknown;
  }>;
  /** True when anything at all is withheld — say so, never render a silent void. */
  restrictedByOwner: boolean;
  /** "This view was recorded in the owner's access ledger." */
  ledgerNotice?: { ar: string; en: string } | null;
  isOwnPatient: boolean;
  visitCountHere: number;
  lastVisitAt?: string | null;
  /** `null` means WITHHELD. `[]` means none on file. See the note above. */
  vaccinations: VetVaccination[] | null;
  weights: VetWeightPoint[] | null;
  /** True when consent withheld the whole care summary (tier 0). */
  careWithheld: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The record
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Timeline kinds. The first group mirrors the database's `ClinicalEntryType`
 * one-for-one — all fourteen of them, deliberately: in an append-only medical
 * record, filing a surgery as a "note" would lose that fact permanently and
 * silently, because nothing can ever be edited back. The last three are
 * display-only markers the timeline synthesises (a visit boundary, a bare
 * attachment, a consent change); they are never sent to `createRecord`.
 */
export type VetTimelineKind =
  // ── real clinical entry types (must match the Prisma enum exactly) ──
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
  | "NOTE"
  // ── timeline-only display markers ──
  | "VISIT"
  | "ATTACHMENT"
  | "CONSENT";

/** Records are append-only: a correction is a new entry pointing at the old one. */
export type VetEntryStatus = "DRAFT" | "AWAITING_COSIGN" | "FINAL" | "RETRACTED";

export interface VetAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url?: string | null;
  uploadedAt: string;
  /** Queued locally, not yet on the server (uploads must never block a visit). */
  pending?: boolean;
}

export interface VetTimelineEntry {
  id: string;
  kind: VetTimelineKind;
  at: string;
  titleEn: string;
  titleAr: string;
  bodyEn?: string | null;
  bodyAr?: string | null;
  status: VetEntryStatus;
  authorName: string;
  authorRole: VetRole | null;
  /** The clinic that authored it — cross-clinic history is labelled, always. */
  orgId?: string | null;
  orgNameEn?: string | null;
  orgNameAr?: string | null;
  /** Set when this entry supersedes an earlier one. */
  revisionOf?: string | null;
  cosignedBy?: string | null;
  cosignedAt?: string | null;
  attachments?: VetAttachment[];
}

/**
 * Re-exported from the shared contract rather than redeclared.
 *
 * These were previously invented client-side and did not match the API on ANY
 * value — the portal tested for "ACTIVE"/"COMPLETED" against a server that
 * sends ISSUED/COLLECTED/REFILLED/COMPLETED/EXPIRED/CANCELLED.
 */
export type VetPrescriptionStatus = CorePrescriptionStatus;

export interface VetPrescription {
  id: string;
  catId: string;
  drugNameEn: string;
  drugNameAr: string;
  dose: string;
  frequencyEn: string;
  frequencyAr: string;
  durationDays?: number | null;
  startedAt: string;
  endsAt?: string | null;
  status: VetPrescriptionStatus;
  prescribedByName: string;
  dispensedByName?: string | null;
  dispensedAt?: string | null;
  notesEn?: string | null;
  notesAr?: string | null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Visits
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * A visit is OPEN or CLOSED — there is no waiting/in-progress state.
 *
 * The old four-value union is why `visits/[visitId]` computed
 * `state === "COMPLETED" || state === "CANCELLED"` and got `false` for every
 * closed visit: a vet saw an editable chart, wrote a full SOAP note, and the
 * save 409'd with VET_VISIT_CLOSED.
 */
export type VetVisitState = CoreVisitState;

/** One row of the clinic's own patient list. */
export interface VetOwnPatient {
  catId: string;
  name: string;
  catIdNumber: string | null;
  photoUrl: string | null;
  membershipStatus: string;
  ownerName: string | null;
  lastVisitAt: string | null;
  hasOpenVisit: boolean;
  isOwnPatient: true;
}

export interface VetOwnPatientsResponse {
  items: VetOwnPatient[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Record reads carry the consent context they were resolved under. */
export type VetTimelineResponse = RecordList<VetTimelineEntry> & {
  hiddenSections?: Array<{
    section: string;
    reason: { code: string; ar: string; en: string };
    remedy?: unknown;
  }>;
  ledgerNotice?: { ar: string; en: string };
};

export type VetPrescriptionResponse = RecordList<VetPrescription>;

/** Weights come back as a described series, not bare points. */
export interface VetWeightSeriesResponse {
  catId: string;
  catName: string;
  currentWeightKg: number | null;
  windowMonths: number;
  series: VetWeightPoint[];
  /** Arithmetic restated in words. Deliberately never a diagnosis. */
  trend: { ar: string; en: string; direction?: string; deltaKg?: number } | null;
}

/** Mirrors VetVisitsService.present() exactly. */
export interface VetVisit {
  id: string;
  catId: string;
  cat: {
    id: string;
    name: string;
    catIdNumber: string | null;
    photoUrl: string | null;
    membershipStatus: string;
  };
  mode: string;
  state: VetVisitState;
  reason: string | null;
  presentingComplaint: string | null;
  branch: { id: string; ar: string; en: string } | null;
  openedBy: { id: string; name: string; role: string } | null;
  closedBy: { id: string; name: string; role: string } | null;
  checkedInAt: string;
  closedAt: string | null;
  followUpAt: string | null;
  entryCount: number;
  ownerSummary: string | null;
  summarySentAt: string | null;
  /** Minutes since check-in for an OPEN visit; null once closed. */
  waitMinutes: number | null;
  /** A calm nudge, not an alarm — amber at 10 minutes is the only escalation. */
  waitLevel: "calm" | "amber" | null;
}

export type VetVisitListResponse = Paginated<VetVisit> & {
  summary: { openNow: number };
};

/** getVisit returns the visit WITH its entries — not a bare visit. */
export interface VetVisitDetail {
  visit: VetVisit;
  entries: VetTimelineEntry[];
  draftCount: number;
}

export interface VetVisitQuery {
  /** ISO date (YYYY-MM-DD). Omit for the current day-book. */
  date?: string;
  state?: VetVisitState;
  branchId?: string;
  catId?: string;
  page?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Consent, audit, emergency
 * ──────────────────────────────────────────────────────────────────────────*/

export type VetConsentScope = "STANDING" | "VISIT" | "WINDOW";

export interface VetConsentGrant {
  id: string;
  catId: string;
  catName?: string | null;
  tier: VetConsentTier;
  scope: VetConsentScope;
  grantedAt: string | null;
  /** Null for a standing grant; a timestamp for a "share for 24 hours" grant. */
  expiresAt: string | null;
  state: "PENDING" | "GRANTED" | "DENIED" | "EXPIRED" | "REVOKED";
  requestedByName?: string | null;
  requestedAt?: string | null;
}

/** One row of the trail the owner can read back. Trust is bilateral (P3). */
export interface VetAccessLogRow {
  id: string;
  at: string;
  actorName: string;
  actorRole: VetRole | null;
  action:
    | "SEARCH"
    | "PROFILE_VIEW"
    | "RECORD_READ"
    | "RECORD_WRITE"
    | "PHONE_REVEAL"
    | "BENEFIT_APPLY"
    | "EMERGENCY_ACCESS"
    | "EXPORT";
  catId?: string | null;
  catName?: string | null;
  /** Free-text reason — required for break-glass access. */
  reason?: string | null;
  branchId?: string | null;
  counterMode?: boolean;
}

/**
 * Break-glass. An unconscious cat arrives with no owner: tier-0 safety data is
 * released against a stated reason, and the owner is told it happened.
 */
/**
 * VIEW MODEL — produced by `adaptEmergencyPayload` (lib/vet-wire.ts).
 *
 * The server nests the animal under `cat`, the safety data under
 * `criticalAlerts`, and the accountability trail under `audit`. This screen
 * read `payload.name`, `payload.alerts` and `payload.accessId` — none of which
 * exist on the wire — so break-glass rendered a blank cat.
 *
 * `alerts` here is ALREADY FLAT, unlike the profile's grouped `VetTier0Alerts`:
 * emergency allergies arrive as bare strings with no id, so they are lifted in
 * the adapter rather than pushed through flattenTier0Alerts, which would have
 * emitted `labelEn: undefined` for every one of them.
 */
export interface VetEmergencyPayload {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  sex: VetSex;
  birthDate?: string | null;
  ageMonths?: number | null;
  weightKg?: number | null;
  microchip?: string | null;
  breedEn?: string | null;
  breedAr?: string | null;
  /** FLAT and display-ready. See the note above. */
  alerts: VetMedicalAlert[];
  hasCritical: boolean;
  /**
   * "No allergies on file — that is not the same as none."
   * Sent whenever the allergy list is empty. In an emergency an empty list
   * must never read as a clearance, so this is not optional chrome.
   */
  disclaimer: { ar: string; en: string } | null;
  owner: VetOwnerContact;
  emergencyContacts: Array<{ id: string; name: string; phone: string | null; relation?: string | null; isPrimary: boolean }>;
  primaryClinic: {
    id: string;
    ar: string;
    en: string;
    branch: { ar: string; en: string; phone: string | null } | null;
    lastSeenAt: string | null;
  } | null;
  /** Recorded against the actor; the owner is notified. */
  accessId: string | null;
  accessedAt: string | null;
  reason: string | null;
  ownerNotified: boolean;
  auditNotice: { ar: string; en: string } | null;
  nextStep: { action: string; ar: string; en: string } | null;
}

export interface VetEmergencyRequest {
  /**
   * The cat's internal id — break-glass is reached FROM a resolved patient, so
   * the cat is already identified by the time this is called.
   *
   * This was declared as a free-text `identifier` ("Cat ID number, microchip,
   * or QR token") and posted to `POST /vet/emergency` as `{identifier, reason}`.
   * The route is `POST /vet/emergency/:catId` taking `{reason}` — so every
   * break-glass attempt 404'd. Resolving an unknown identifier is the scan
   * screen's job; by here it is done.
   */
  catId: string;
  reason: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Clinic-level surfaces
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * The Today numbers. Every field is optional and the whole endpoint may be
 * absent — Today degrades to the day-book rather than inventing a figure.
 */
export interface VetOrgSummary {
  orgNameEn?: string;
  orgNameAr?: string;
  orgStatus?: VetOrgStatus;
  visitsToday?: { open: number; completed: number };
  /** Member rates honoured this month, in SAR — the clinic's mirror of R041. */
  benefitHonouredThisMonth?: { amount: number; visits: number };
  newMembersNearby?: number;
  /** Follow-ups the clinic promised and hasn't closed. */
  pendingFollowUps?: VetFollowUp[];
  /** Vaccinations due for this clinic's own patients — powers recall calls. */
  vaccinationsDue?: VetVaccinationDue[];
  /** Licence expiry, unverified device, pending invite… — always actionable. */
  attention?: VetAttentionItem[];
}

export interface VetFollowUp {
  id: string;
  catId: string;
  catName: string;
  catPhotoUrl?: string | null;
  dueAt: string;
  reasonEn?: string | null;
  reasonAr?: string | null;
  assignedStaffName?: string | null;
}

export interface VetVaccinationDue {
  catId: string;
  catName: string;
  catPhotoUrl?: string | null;
  vaccineEn: string;
  vaccineAr: string;
  dueAt: string;
  ownerName?: string | null;
}

export interface VetAttentionItem {
  id: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  titleEn: string;
  titleAr: string;
  href?: string | null;
  actionEn?: string | null;
  actionAr?: string | null;
}

/** A clinic as members see it in the directory. */
export interface VetDirectoryEntry {
  orgId: string;
  nameEn: string;
  nameAr: string;
  city: string;
  cityAr?: string | null;
  benefitEn?: string | null;
  benefitAr?: string | null;
  logoUrl?: string | null;
  branches: number;
  status: VetOrgStatus;
}

export interface VetApplicationInput {
  clinicNameEn: string;
  clinicNameAr: string;
  crNumber: string;
  city: string;
  branchCount: number;
  contactName: string;
  phone: string;
  email: string;
  why?: string;
}

export interface VetApplicationResult {
  applicationId: string;
  /** Working days the clinic should expect to wait — never a fabricated promise. */
  reviewDays?: number;
}

/**
 * Accepting an invite returns a FLAT orgId plus a name-only `org` — a different
 * shape from the auth context's membership, which nests the full clinic. Kept
 * distinct rather than forced into one type, because pretending they match is
 * exactly how the portal ended up sending `x-moracat-org: undefined`.
 */
export interface VetInviteResult {
  staffId: string;
  orgId: string;
  role: VetRole;
  roleLabel?: { ar: string; en: string };
  capabilities?: VetCapability[];
  org: { nameEn: string; nameAr: string };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Errors — bilingual, recovery-shaped, never raw server prose
 * ──────────────────────────────────────────────────────────────────────────*/

export const VET_ERROR_CODES = [
  "VET_NOT_STAFF",
  "VET_ORG_SUSPENDED",
  "VET_ORG_NOT_LIVE",
  "VET_STAFF_SUSPENDED",
  "VET_ORG_REQUIRED",
  "VET_FORBIDDEN",
  "VET_SEARCH_SCOPED",
] as const;

export type VetErrorCode = (typeof VET_ERROR_CODES)[number];

const VET_ERROR_COPY: Record<VetErrorCode, { ar: FriendlyError; en: FriendlyError }> = {
  VET_NOT_STAFF: {
    ar: {
      title: "هذا الحساب ليس ضمن فريق عيادة",
      message: "لا يوجد ارتباط بين هذا البريد وأي عيادة شريكة. اطلب من مدير العيادة دعوتك، أو قدّم طلب انضمام لعيادتك.",
    },
    en: {
      title: "This account isn't on a clinic team",
      message: "This email isn't linked to a partner clinic yet. Ask your clinic manager to invite you, or apply to bring your clinic in.",
    },
  },
  VET_ORG_SUSPENDED: {
    ar: {
      title: "حساب العيادة موقوف",
      message: "أوقفنا وصول هذه العيادة مؤقتاً. تواصل مع شراكات مرقط لمعرفة السبب وإعادة التفعيل — سجلاتكم محفوظة كما هي.",
    },
    en: {
      title: "This clinic's access is paused",
      message: "We've suspended this clinic's access for now. Contact Moracat partnerships to see why and restore it — your records are untouched.",
    },
  },
  VET_ORG_NOT_LIVE: {
    ar: {
      title: "العيادة لم تُفعَّل بعد",
      message: "بقيت خطوات في تجهيز العيادة قبل أن يعمل الكاونتر. أكمل قائمة التجهيز أو تواصل مع فريق الشراكات.",
    },
    en: {
      title: "This clinic isn't live yet",
      message: "A few setup steps remain before the counter goes live. Finish the onboarding checklist, or reach the partnerships team.",
    },
  },
  VET_STAFF_SUSPENDED: {
    ar: {
      title: "حسابك في هذه العيادة موقوف",
      message: "أوقف مدير العيادة هذا الحساب. تواصل معه لإعادة تفعيله — لم يُحذف أي شيء من سجلك.",
    },
    en: {
      title: "Your access to this clinic is paused",
      message: "A clinic manager paused this account. Ask them to restore it — nothing in your record was deleted.",
    },
  },
  VET_ORG_REQUIRED: {
    ar: {
      title: "اختر العيادة أولاً",
      message: "هذا الإجراء يحتاج تحديد العيادة التي تعمل باسمها الآن. اخترها من مبدّل العيادات في الأعلى.",
    },
    en: {
      title: "Choose a clinic first",
      message: "This action needs to know which clinic you're acting for. Pick one from the clinic switcher at the top.",
    },
  },
  VET_FORBIDDEN: {
    ar: {
      title: "هذه الصلاحية ليست ضمن دورك",
      message: "دورك الحالي لا يشمل هذا الإجراء. مدير العيادة يستطيع تنفيذه أو تعديل دورك.",
    },
    en: {
      title: "Your role doesn't include this",
      message: "This action isn't part of your current role. A clinic manager can do it, or change your role.",
    },
  },
  VET_SEARCH_SCOPED: {
    ar: {
      title: "البحث بالاسم داخل مرضى عيادتك فقط",
      message: "أسماء الأعضاء الآخرين ليست قابلة للتصفح — هذه حماية لهم. إذا كان العضو أمامك، امسح بطاقته أو اكتب رقم الهوية أو جواله.",
    },
    en: {
      title: "Name search covers your own patients",
      message: "Other members aren't browsable by name — that boundary protects them. If the member is with you, scan their card or enter their Cat ID or phone.",
    },
  },
};

/** True when `err` is the given clinic-side API error code. */
export function isVetError(err: unknown, code: VetErrorCode): boolean {
  return err instanceof ApiError && err.code === code;
}

/** The clinic-side code an error carries, if any. */
export function vetErrorCode(err: unknown): VetErrorCode | undefined {
  if (!(err instanceof ApiError) || !err.code) return undefined;
  return (VET_ERROR_CODES as readonly string[]).includes(err.code)
    ? (err.code as VetErrorCode)
    : undefined;
}

/**
 * The ONLY way portal code renders a failure. Clinic-specific codes get the
 * copy above; everything else falls through to the shared member-app catalogue
 * (`friendlyError`), so no surface can ever leak raw English server prose.
 */
export function vetFriendlyError(err: unknown, isAr: boolean): FriendlyError {
  const code = vetErrorCode(err);
  if (code) return { code, ...VET_ERROR_COPY[code][isAr ? "ar" : "en"] };
  return friendlyError(err, isAr);
}

/** Convenience: one string for toast bodies. */
export function vetFriendlyMessage(err: unknown, isAr: boolean): string {
  return vetFriendlyError(err, isAr).message;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Input detection — the omnibox brain (dossier §05)
 * ──────────────────────────────────────────────────────────────────────────*/

/** Strip the noise a scanner, a keyboard, or a printed card introduces. */
export function normalizeVetQuery(raw: string): string {
  return raw.trim().replace(/[‎‏]/g, "");
}

/** Arabic-Indic and Eastern-Arabic digits → Latin, so ٠٥٥ matches 055. */
export function latinizeDigits(input: string): string {
  return input.replace(/[٠-٩۰-۹]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/** `mrc 7h2k 94qf` → `MRC-7H2K-94QF`. Hyphens, case and spaces are forgiven. */
export function canonicalCatIdNumber(input: string): string | null {
  const cleaned = latinizeDigits(normalizeVetQuery(input))
    .toUpperCase()
    .replace(/[\s\-_.]/g, "");
  const body = cleaned.startsWith("MRC") ? cleaned.slice(3) : cleaned;
  if (!/^[A-Z0-9]{8}$/.test(body)) return null;
  return `MRC-${body.slice(0, 4)}-${body.slice(4)}`;
}

/** Normalise 05…, 9665…, +9665… to a single comparable form. */
export function canonicalSaudiPhone(input: string): string | null {
  const digits = latinizeDigits(normalizeVetQuery(input)).replace(/[\s\-()]/g, "");
  const m = /^(?:\+?966|00966|0)?(5\d{8})$/.exec(digits);
  return m ? `+966${m[1]}` : null;
}

/**
 * Decide what the operator meant before the server answers, so the omnibox can
 * show an honest type chip instantly. Same ladder the API applies — kept here
 * only for the chip and for choosing the right empty state, never for auth.
 */
export function detectVetQuery(raw: string): VetDetectedType {
  const value = normalizeVetQuery(raw);
  if (!value) return "name";
  // A scanned card is a URL or an opaque token — never something a human types.
  if (/^https?:\/\//i.test(value) || /^moracat:/i.test(value)) return "qr";
  if (/^[A-Za-z0-9_-]{20,}$/.test(value) && !/\s/.test(value)) return "qr";
  if (canonicalCatIdNumber(value)) return "catId";
  const digits = latinizeDigits(value).replace(/[\s\-()]/g, "");
  if (/^\d{15}$/.test(digits)) return "microchip";
  if (canonicalSaudiPhone(value)) return "phone";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
  return "name";
}

/**
 * A scanned Cat ID card encodes a URL; a typed one is just the number. Reduce
 * both to the thing the API can look up, so the scanner and the omnibox share
 * one pipeline after decode.
 */
export function extractScanToken(raw: string): string {
  const value = normalizeVetQuery(raw);
  if (!/^https?:\/\//i.test(value)) return value;
  try {
    const url = new URL(value);
    const token = url.searchParams.get("t") ?? url.pathname.split("/").filter(Boolean).pop();
    return token ?? value;
  } catch {
    return value;
  }
}

/** Bilingual label for the detection chip. */
export function vetDetectedTypeLabel(type: VetDetectedType, isAr: boolean): string {
  switch (type) {
    case "catId":
      return isAr ? "رقم هوية القط" : "Cat ID";
    case "qr":
      return isAr ? "بطاقة ممسوحة" : "Scanned card";
    case "microchip":
      return isAr ? "رقم الشريحة" : "Microchip";
    case "phone":
      return isAr ? "جوال المالك" : "Owner phone";
    case "email":
      return isAr ? "بريد المالك" : "Owner email";
    default:
      return isAr ? "اسم" : "Name";
  }
}

/** True for identifiers that prove possession — these reach any member. */
export function isExactIdentifier(type: VetDetectedType): boolean {
  return type === "catId" || type === "qr" || type === "microchip" || type === "phone" || type === "email";
}

/* ────────────────────────────────────────────────────────────────────────────
 * Recent lookups — device-local, 24h, cleared on sign-out
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetRecentLookup {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  at: number;
}

export function readRecentLookups(): VetRecentLookup[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as VetRecentLookup[];
    const cutoff = Date.now() - RECENTS_TTL_MS;
    return parsed.filter((r) => r && typeof r.at === "number" && r.at > cutoff).slice(0, RECENTS_MAX);
  } catch {
    return [];
  }
}

export function pushRecentLookup(entry: Omit<VetRecentLookup, "at">): VetRecentLookup[] {
  if (typeof window === "undefined") return [];
  const next = [{ ...entry, at: Date.now() }, ...readRecentLookups().filter((r) => r.catId !== entry.catId)].slice(
    0,
    RECENTS_MAX,
  );
  try {
    localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recents are a convenience, never a dependency */
  }
  return next;
}

export function clearRecentLookups(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(RECENTS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Persist the chosen clinic outside the provider — sign-in picks the org before
 * the shell (and its context) ever mounts.
 */
export function rememberVetOrg(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
  } catch {
    /* ignore */
  }
}

export function readRememberedVetOrg(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Stable per-browser terminal id — needed to unlock Counter Mode. */
export function getVetDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Public (unauthenticated) endpoints
 * ──────────────────────────────────────────────────────────────────────────*/

async function publicJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetchWithTimeout(`${API_BASE}/api${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw httpError(res.status, json);
  return json as T;
}

/** POST /vet/apply — a clinic asking to join the network. */
export function submitVetApplication(input: VetApplicationInput): Promise<VetApplicationResult> {
  return publicJson<VetApplicationResult>("/vet/apply", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /vet/directory — the public list of live partner clinics. */
export function fetchVetDirectory(): Promise<{ clinics: VetDirectoryEntry[] }> {
  return publicJson<{ clinics: VetDirectoryEntry[] }>("/vet/directory");
}

/* ────────────────────────────────────────────────────────────────────────────
 * The actor context
 * ──────────────────────────────────────────────────────────────────────────*/

export interface VetActorValue {
  /** False until memberships have been resolved (or failed) — gate on this. */
  ready: boolean;
  loading: boolean;
  error: unknown;
  memberships: VetMembership[];
  /** The clinic every call speaks for. Null only before a choice exists. */
  orgId: string | null;
  org: VetMembership | null;
  role: VetRole | null;
  capabilities: VetCapability[];
  /** True on a shared terminal unlocked by PIN — capabilities are reduced. */
  counterMode: boolean;
  counterSession: VetCounterSession | null;
  branchId: string | null;
  branch: VetBranch | null;
  setOrg: (orgId: string) => void;
  setBranch: (branchId: string | null) => void;
  /** Capability check for the current actor. Renders, never authorises. */
  can: (capability: VetCapability) => boolean;
  refresh: () => Promise<void>;
  /** Called by the counter unlock/lock flow. */
  applyCounterSession: (session: VetCounterSession | null) => void;
}

const VetActorContext = React.createContext<VetActorValue | null>(null);

/**
 * Who is acting, where, with what power. Everything in the portal reads this —
 * the nav, the shell, and every screen that decides what to render.
 */
export function useVetActor(): VetActorValue {
  const ctx = React.useContext(VetActorContext);
  if (!ctx) throw new Error("useVetActor must be used within VetActorProvider");
  return ctx;
}

export function VetActorProvider({ children }: { children: React.ReactNode }) {
  const { authedFetch, user, ready: authReady } = useAuth();

  const [memberships, setMemberships] = React.useState<VetMembership[]>([]);
  const [orgId, setOrgId] = React.useState<string | null>(null);
  const [branchId, setBranchId] = React.useState<string | null>(null);
  const [counterSession, setCounterSession] = React.useState<VetCounterSession | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [ready, setReady] = React.useState(false);
  const [error, setError] = React.useState<unknown>(null);

  const load = React.useCallback(async () => {
    if (!user) {
      setMemberships([]);
      setReady(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const ctx = await authedFetch<VetAuthContext>("/vet/auth/context", { method: "POST", body: "{}" });
      const list = ctx?.memberships ?? [];
      setMemberships(list);
      setOrgId((current) => {
        if (current && list.some((m) => m.org.id === current)) return current;
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(ORG_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        if (stored && list.some((m) => m.org.id === stored)) return stored;
        // Prefer a clinic the person can actually work in today.
        const usable = list.find((m) => m.status === "ACTIVE") ?? list[0];
        return usable?.org.id ?? null;
      });
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [authedFetch, user]);

  React.useEffect(() => {
    if (!authReady) return;
    void load();
  }, [authReady, load]);

  // Restore the branch choice once memberships are known.
  React.useEffect(() => {
    if (!orgId) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(`${BRANCH_STORAGE_KEY}.${orgId}`);
    } catch {
      /* ignore */
    }
    const org = memberships.find((m) => m.org.id === orgId);
    setBranchId(stored && org?.branches.some((b) => b.id === stored) ? stored : null);
  }, [orgId, memberships]);

  const setOrg = React.useCallback((next: string) => {
    setOrgId(next);
    setCounterSession(null); // a terminal identity never follows you to another clinic
    try {
      localStorage.setItem(ORG_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const setBranch = React.useCallback(
    (next: string | null) => {
      setBranchId(next);
      if (!orgId) return;
      try {
        if (next) localStorage.setItem(`${BRANCH_STORAGE_KEY}.${orgId}`, next);
        else localStorage.removeItem(`${BRANCH_STORAGE_KEY}.${orgId}`);
      } catch {
        /* ignore */
      }
    },
    [orgId],
  );

  const org = React.useMemo(
    () => memberships.find((m) => m.org.id === orgId) ?? null,
    [memberships, orgId],
  );
  const role = org?.role ?? null;
  const counterMode = !!counterSession;
  // A PIN identity outranks the personal one *for this terminal only*.
  const effectiveRole = counterSession?.role ?? role;

  const capabilities = React.useMemo<VetCapability[]>(
    () => (effectiveRole ? capabilitiesFor({ role: effectiveRole, counterMode }) : []),
    [effectiveRole, counterMode],
  );

  const can = React.useCallback(
    (capability: VetCapability) =>
      effectiveRole ? coreCan({ role: effectiveRole, counterMode }, capability) : false,
    [effectiveRole, counterMode],
  );

  const branch = React.useMemo(
    () => org?.branches.find((b) => b.id === branchId) ?? null,
    [org, branchId],
  );

  const value = React.useMemo<VetActorValue>(
    () => ({
      ready: ready && authReady,
      loading,
      error,
      memberships,
      orgId,
      org,
      role: effectiveRole,
      capabilities,
      counterMode,
      counterSession,
      branchId,
      branch,
      setOrg,
      setBranch,
      can,
      refresh: load,
      applyCounterSession: setCounterSession,
    }),
    [
      ready, authReady, loading, error, memberships, orgId, org, effectiveRole, capabilities,
      counterMode, counterSession, branchId, branch, setOrg, setBranch, can, load,
    ],
  );

  // createElement, not JSX — this module is a `.ts` file on purpose: it is the
  // shared contract, imported by server-ish and client code alike.
  return React.createElement(VetActorContext.Provider, { value }, children);
}

/* ────────────────────────────────────────────────────────────────────────────
 * The authenticated fetchers
 * ──────────────────────────────────────────────────────────────────────────*/

export type VetFetch = <T = unknown>(path: string, init?: RequestInit) => Promise<T>;

/**
 * Low-level org-scoped fetch. Every clinic call goes through here so the
 * `x-moracat-org` header can never be forgotten — and a call made before a
 * clinic is chosen fails locally with the same code the API would send, rather
 * than silently asking for someone else's patients.
 */
export function useVetFetch(): VetFetch {
  const { authedFetch } = useAuth();
  const { orgId } = useVetActor();

  return React.useCallback<VetFetch>(
    (path, init = {}) => {
      if (!orgId) {
        return Promise.reject(
          new ApiError("Choose a clinic first", "http", 400, "VET_ORG_REQUIRED"),
        );
      }
      return authedFetch(path, {
        ...init,
        headers: { ...(init.headers ?? {}), "x-moracat-org": orgId },
      });
    },
    [authedFetch, orgId],
  );
}

export interface VetApi {
  /** POST /vet/auth/context — every clinic this person belongs to. */
  authContext: () => Promise<VetAuthContext>;
  /** POST /vet/auth/accept-invite */
  acceptInvite: (token: string) => Promise<VetInviteResult>;
  /** POST /vet/auth/counter/unlock — PIN identity switch on a shared terminal. */
  counterUnlock: (input: VetCounterUnlockInput) => Promise<VetCounterSession>;
  /** POST /vet/auth/counter/lock */
  counterLock: () => Promise<void>;
  /** GET /vet/patients/search?q= — the omnibox. */
  searchPatients: (q: string, opts?: { signal?: AbortSignal }) => Promise<VetSearchResponse>;
  /** GET /vet/patients/:catId — the clinical profile, consent-filtered. */
  getPatient: (catId: string) => Promise<VetPatientProfile>;
  /** GET /vet/patients/:catId/timeline */
  getPatientTimeline: (catId: string) => Promise<VetTimelineResponse>;
  /** GET /vet/patients/:catId/prescriptions */
  getPatientPrescriptions: (catId: string) => Promise<VetPrescriptionResponse>;
  /** GET /vet/patients/:catId/weights */
  getPatientWeights: (catId: string) => Promise<VetWeightSeriesResponse>;
  /** GET /vet/patients — the clinic's own browsable patient memory. */
  /** GET /vet/patients — the clinic's own browsable patient memory. */
  listPatients: (params?: { q?: string; cursor?: string }) => Promise<VetOwnPatientsResponse>;
  /** GET /vet/visits?date=&state= — the day-book. */
  listVisits: (query?: VetVisitQuery) => Promise<VetVisitListResponse>;
  /** GET /vet/visits/:id — returns the visit WITH its entries. */
  getVisit: (id: string) => Promise<VetVisitDetail>;
  /** POST /vet/visits — open a visit for a cat. */
  openVisit: (input: { catId: string; reason?: string; branchId?: string }) => Promise<VetVisit>;
  /** POST /vet/visits/:id/close */
  closeVisit: (id: string) => Promise<VetVisit>;
  /** GET /vet/org/summary — Today's numbers; may legitimately not exist. */
  getOrgSummary: () => Promise<VetOrgSummary | null>;
  /** GET /vet/consent?catId= */
  listConsent: (catId?: string) => Promise<{ grants: VetConsentGrant[] }>;
  /** POST /vet/consent/request — ask the owner for a higher tier. */
  requestConsent: (input: { catId: string; tier: VetConsentTier; scope: VetConsentScope }) => Promise<VetConsentGrant>;
  /** GET /vet/access-log */
  listAccessLog: (params?: { catId?: string; cursor?: string }) => Promise<{
    rows: VetAccessLogRow[];
    nextCursor?: string | null;
  }>;
  /** POST /vet/emergency/:catId — break-glass, always against a stated reason. */
  emergencyLookup: (input: VetEmergencyRequest) => Promise<VetEmergencyPayload>;

  // ── Clinical authorship ───────────────────────────────────────────────
  // The record is append-only: there is deliberately no `updateRecord` and no
  // `deleteRecord`. A correction is a NEW entry that supersedes its
  // predecessor (`reviseRecord`); a withdrawal marks the entry retracted with
  // a reason. Medical history stays reconstructable forever.
  /** POST /vet/records — author a clinical entry (DRAFT when the author is an intern). */
  createRecord: (input: {
    catId: string;
    visitId?: string | null;
    type: VetTimelineKind;
    payload: Record<string, unknown>;
    note?: string;
    occurredAt?: string;
  }) => Promise<VetTimelineEntry>;
  /** POST /vet/records/:id/revise — supersede an entry with a corrected one. */
  reviseRecord: (
    entryId: string,
    input: { payload: Record<string, unknown>; note?: string; reason?: string }
  ) => Promise<VetTimelineEntry>;
  /** POST /vet/records/:id/retract — withdraw an entry, reason required. */
  retractRecord: (entryId: string, input: { reason: string }) => Promise<VetTimelineEntry>;
  /** POST /vet/records/:id/cosign — a senior countersigns a trainee's draft. */
  cosignRecord: (entryId: string) => Promise<VetTimelineEntry>;
  /** POST /vet/records/:id/attachments — attach an already-uploaded object. */
  uploadRecordAttachment: (
    entryId: string,
    input: { fileUrl: string; fileName?: string; mime?: string; kind?: string }
  ) => Promise<VetAttachment>;
  /** POST /vet/prescriptions/:id/status — dispense / complete / cancel. */
  setPrescriptionStatus: (id: string, status: VetPrescriptionStatus) => Promise<VetPrescription>;
  /** POST /vet/visits/:id/owner-summary — the plain-language note the owner receives. */
  sendOwnerSummary: (visitId: string, summary: string) => Promise<VetVisit>;
}

/**
 * The typed surface every portal screen uses. Bound to the active clinic, so a
 * screen never handles org scoping itself.
 */
export function useVetApi(): VetApi {
  const vetFetch = useVetFetch();

  return React.useMemo<VetApi>(
    () => ({
      authContext: () => vetFetch<VetAuthContext>("/vet/auth/context", { method: "POST", body: "{}" }),

      acceptInvite: (token) =>
        vetFetch<VetInviteResult>("/vet/auth/accept-invite", {
          method: "POST",
          body: JSON.stringify({ token }),
        }),

      counterUnlock: (input) =>
        vetFetch<VetCounterSession>("/vet/auth/counter/unlock", {
          method: "POST",
          body: JSON.stringify(input),
        }),

      counterLock: () => vetFetch<void>("/vet/auth/counter/lock", { method: "POST", body: "{}" }),

      // ── The wire crossing ────────────────────────────────────────────────
      // These four responses are nested on the server and flat on screen. The
      // adapters in lib/vet-wire.ts are the ONLY place that bridges the two;
      // every previous attempt to let a screen read the response directly has
      // ended in a blank page or an error boundary. See that file's header.
      searchPatients: async (q, opts) =>
        adaptSearchResponse(
          assertShape<VetWireSearchResponse>(
            await vetFetch(`/vet/patients/search?q=${encodeURIComponent(q)}`, { signal: opts?.signal }),
            ["query", "scope", "results"],
            "GET /vet/patients/search",
          ),
        ),

      getPatient: async (catId) =>
        adaptPatientProfile(
          assertShape<VetWirePatientProfile>(
            await vetFetch(`/vet/patients/${encodeURIComponent(catId)}`),
            ["catId", "alerts", "access", "clinicRelationship"],
            "GET /vet/patients/:catId",
          ),
        ),

      // Each of these validates the envelope it is about to read. The previous
      // bare casts are why a contract mismatch rendered a blank screen instead
      // of an error: the data was wrong and nothing ever threw.
      // Timeline entries carry no title, body or author name on the wire —
      // just `type` + raw `payload`. The adapter renders them; without it the
      // timeline drew one "Invalid Date" row per entry.
      getPatientTimeline: async (catId) => {
        const raw = assertShape<{ items: unknown[] } & Record<string, unknown>>(
          await vetFetch(`/vet/patients/${encodeURIComponent(catId)}/timeline`),
          ["items", "access", "pagination"],
          "GET /vet/patients/:catId/timeline",
        );
        return {
          ...raw,
          items: (raw.items ?? []).map((e) => adaptTimelineEntry(e as VetWireTimelineEntry)),
        } as unknown as VetTimelineResponse;
      },

      getPatientPrescriptions: async (catId) => {
        const raw = assertShape<{ items: unknown[] } & Record<string, unknown>>(
          await vetFetch(`/vet/patients/${encodeURIComponent(catId)}/prescriptions`),
          ["items", "access", "pagination"],
          "GET /vet/patients/:catId/prescriptions",
        );
        return {
          ...raw,
          items: (raw.items ?? []).map((p) => adaptPrescription(p as VetWirePrescription)),
        } as unknown as VetPrescriptionResponse;
      },

      // The chart read `p.at`/`p.kg` against rows keyed `measuredAt`/`weightKg`
      // and plotted NaN for every point — an empty chart, never an error. The
      // envelope assert passed the whole time, because only the top-level keys
      // were ever checked.
      getPatientWeights: async (catId) =>
        adaptWeightSeries(
          assertShape<VetWireWeightSeries>(
            await vetFetch(`/vet/patients/${encodeURIComponent(catId)}/weights`),
            ["series", "trend"],
            "GET /vet/patients/:catId/weights",
          ),
        ),

      listPatients: (params) => {
        const qs = new URLSearchParams();
        if (params?.q) qs.set("q", params.q);
        if (params?.cursor) qs.set("cursor", params.cursor);
        const suffix = qs.toString();
        return vetFetch(`/vet/patients${suffix ? `?${suffix}` : ""}`).then((r) =>
          assertShape<VetOwnPatientsResponse>(r, ["items", "hasMore"], "GET /vet/patients"),
        );
      },

      listVisits: (query) => {
        const qs = new URLSearchParams();
        if (query?.date) qs.set("date", query.date);
        if (query?.state) qs.set("state", query.state);
        if (query?.branchId) qs.set("branchId", query.branchId);
        if (query?.catId) qs.set("catId", query.catId);
        if (query?.page) qs.set("page", String(query.page));
        const suffix = qs.toString();
        return vetFetch(`/vet/visits${suffix ? `?${suffix}` : ""}`).then((r) =>
          assertShape<VetVisitListResponse>(r, ["items", "summary", "pagination"], "GET /vet/visits"),
        );
      },

      getVisit: async (id) =>
        assertShape<VetVisitDetail>(
          await vetFetch(`/vet/visits/${encodeURIComponent(id)}`),
          ["visit", "entries", "draftCount"],
          "GET /vet/visits/:id",
        ),

      openVisit: (input) =>
        vetFetch<VetVisit>("/vet/visits", { method: "POST", body: JSON.stringify(input) }),

      closeVisit: (id) =>
        vetFetch<VetVisit>(`/vet/visits/${encodeURIComponent(id)}/close`, { method: "POST", body: "{}" }),

      // Today must survive this endpoint not existing yet: a missing summary is
      // "no numbers to show", never an error banner over the day's work.
      getOrgSummary: async () => {
        try {
          return await vetFetch<VetOrgSummary>("/vet/org/summary");
        } catch (err) {
          if (err instanceof ApiError && err.status === 404) return null;
          throw err;
        }
      },

      listConsent: (catId) =>
        vetFetch<{ grants: VetConsentGrant[] }>(
          `/vet/consent${catId ? `?catId=${encodeURIComponent(catId)}` : ""}`,
        ),

      requestConsent: (input) =>
        vetFetch<VetConsentGrant>("/vet/consent/request", {
          method: "POST",
          body: JSON.stringify(input),
        }),

      listAccessLog: (params) => {
        const qs = new URLSearchParams();
        if (params?.catId) qs.set("catId", params.catId);
        if (params?.cursor) qs.set("cursor", params.cursor);
        const suffix = qs.toString();
        return vetFetch(`/vet/access-log${suffix ? `?${suffix}` : ""}`);
      },

      emergencyLookup: async ({ catId, reason }) =>
        adaptEmergencyPayload(
          assertShape<VetWireEmergencyPayload>(
            await vetFetch(`/vet/emergency/${encodeURIComponent(catId)}`, {
              method: "POST",
              body: JSON.stringify({ reason }),
            }),
            ["cat", "criticalAlerts", "audit"],
            "POST /vet/emergency/:catId",
          ),
        ),

      // ── Clinical authorship (append-only; no update, no delete) ─────────
      createRecord: (input) =>
        vetFetch<VetTimelineEntry>("/vet/records", {
          method: "POST",
          body: JSON.stringify(input),
        }),

      reviseRecord: (entryId, input) =>
        vetFetch<VetTimelineEntry>(`/vet/records/${encodeURIComponent(entryId)}/revise`, {
          method: "POST",
          body: JSON.stringify(input),
        }),

      retractRecord: (entryId, input) =>
        vetFetch<VetTimelineEntry>(`/vet/records/${encodeURIComponent(entryId)}/retract`, {
          method: "POST",
          body: JSON.stringify(input),
        }),

      cosignRecord: (entryId) =>
        vetFetch<VetTimelineEntry>(`/vet/records/${encodeURIComponent(entryId)}/cosign`, {
          method: "POST",
          body: "{}",
        }),

      uploadRecordAttachment: (entryId, input) =>
        vetFetch<VetAttachment>(`/vet/records/${encodeURIComponent(entryId)}/attachments`, {
          method: "POST",
          body: JSON.stringify(input),
        }),

      setPrescriptionStatus: (id, status) =>
        vetFetch<VetPrescription>(`/vet/prescriptions/${encodeURIComponent(id)}/status`, {
          method: "POST",
          body: JSON.stringify({ status }),
        }),

      sendOwnerSummary: (visitId, summary) =>
        vetFetch<VetVisit>(`/vet/visits/${encodeURIComponent(visitId)}/owner-summary`, {
          method: "POST",
          body: JSON.stringify({ summary }),
        }),
    }),
    [vetFetch],
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small shared formatting helpers (bilingual, used across portal screens)
 * ──────────────────────────────────────────────────────────────────────────*/

/** "3y 2m" / "٣ سنوات و شهرين" — an age a clinician reads at a glance. */
export function formatCatAge(months: number | null | undefined, isAr: boolean): string | null {
  if (months == null || months < 0) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (isAr) {
    const yPart = y === 0 ? "" : y === 1 ? "سنة" : y === 2 ? "سنتان" : y <= 10 ? `${y} سنوات` : `${y} سنة`;
    const mPart = m === 0 ? "" : m === 1 ? "شهر" : m === 2 ? "شهران" : m <= 10 ? `${m} أشهر` : `${m} شهراً`;
    return [yPart, mPart].filter(Boolean).join(" و ") || "أقل من شهر";
  }
  const parts = [y > 0 ? `${y}y` : "", m > 0 ? `${m}m` : ""].filter(Boolean);
  return parts.join(" ") || "<1m";
}

/** Bilingual label for a visit state — colour is never the only signal (R093). */
export function vetVisitStateLabel(state: VetVisitState, isAr: boolean): string {
  return state === "OPEN" ? (isAr ? "زيارة مفتوحة" : "Open") : isAr ? "مُغلقة" : "Closed";
}

/** Bilingual label for a membership standing. */
export function vetMembershipStateLabel(state: VetMembershipState, isAr: boolean): string {
  switch (state) {
    case "ACTIVE":
      return isAr ? "عضوية سارية" : "Active member";
    case "EXPIRED":
      return isAr ? "عضوية منتهية" : "Membership expired";
    case "SUSPENDED":
      return isAr ? "عضوية موقوفة" : "Membership paused";
    case "PENDING":
      return isAr ? "عضوية قيد التفعيل" : "Membership starting";
    default:
      return isAr ? "غير عضو" : "Not a member";
  }
}

/** The org's name in the reader's language, with a graceful fallback. */
export function vetOrgName(m: Pick<VetMembership, "org"> | null, isAr: boolean): string {
  if (!m?.org) return "";
  return (isAr ? m.org.nameAr : m.org.nameEn) || m.org.nameEn || m.org.nameAr;
}

/** A branch's name in the reader's language. */
export function vetBranchName(b: VetBranch | null, isAr: boolean): string {
  if (!b) return "";
  return (isAr ? b.nameAr : b.nameEn) || b.nameEn || b.nameAr;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Un-prefixed aliases
 *
 * The canonical names above are `Vet`-prefixed because they share a module
 * namespace with the member app's types. These aliases exist so portal screens
 * can read naturally (`PatientProfile` rather than `VetPatientProfile`) — they
 * are the same types, not a second contract. Data fetching always goes through
 * `useVetApi()`: a bare module-level fetcher cannot exist here, because the
 * access token and the active org both live in React context.
 * ──────────────────────────────────────────────────────────────────────────*/

export type Membership = VetMembership;
export type Branch = VetBranch;
export type AuthContext = VetAuthContext;
export type CounterSession = VetCounterSession;
export type SearchResult = VetSearchResult;
export type SearchResponse = VetSearchResponse;
export type DetectedType = VetDetectedType;
export type PatientProfile = VetPatientProfile;
export type MedicalAlert = VetMedicalAlert;
export type PatientAllergy = VetMedicalAlert;
export type MembershipStanding = VetMembershipStanding;
export type OwnerContact = VetOwnerContact;
export type Vaccination = VetVaccination;
export type WeightPoint = VetWeightPoint;
export type ConsentTier = VetConsentTier;
export type ConsentScope = VetConsentScope;
export type ConsentGrant = VetConsentGrant;
export type TimelineEntry = VetTimelineEntry;
export type EntryType = VetTimelineKind;
export type EntryStatus = VetEntryStatus;
export type Attachment = VetAttachment;
export type Prescription = VetPrescription;
export type PrescriptionStatus = VetPrescriptionStatus;
export type Visit = VetVisit;
export type VisitState = VetVisitState;
export type AccessLogRow = VetAccessLogRow;
export type EmergencyPayload = VetEmergencyPayload;
export type EmergencyRequest = VetEmergencyRequest;
export type OrgSummary = VetOrgSummary;
export type DirectoryEntry = VetDirectoryEntry;
