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
  type VetCapability,
  type VetRole,
} from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { ApiError, fetchWithTimeout, httpError } from "@/lib/http";
import { friendlyError, type FriendlyError } from "@/lib/errors";

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

/** One person's standing inside one clinic. The unit of authorisation. */
export interface VetMembership {
  orgId: string;
  orgNameEn: string;
  orgNameAr: string;
  role: VetRole;
  status: VetMembershipStatus;
  branches: VetBranch[];
  /** Present when the API shares the clinic's lifecycle state. */
  orgStatus?: VetOrgStatus;
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
}

export interface VetSearchResponse {
  results: VetSearchResult[];
  /**
   * True when the query was answered only from this clinic's own patients —
   * the privacy boundary (dossier §05). The UI must say so out loud.
   */
  scoped: boolean;
  detectedType: VetDetectedType;
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

export type VetMembershipState = "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PENDING" | "NONE";

/** The five-second answer: does this membership stand, and what rate is honoured? */
export interface VetMembershipStanding {
  state: VetMembershipState;
  memberSince?: string | null;
  /** Benefit copy exactly as the member reads it — one source, no drift. */
  benefitLabelEn?: string | null;
  benefitLabelAr?: string | null;
  discountPercent?: number | null;
  /** ISO timestamp of this verification. */
  verifiedAt?: string | null;
  /** True when answered from a signed offline card rather than the network. */
  offline?: boolean;
}

export interface VetOwnerContact {
  firstName: string;
  /** Masked by default; the full number is a deliberate, logged reveal. */
  maskedPhone: string;
  phone?: string | null;
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

export interface VetPatientProfile {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  breedEn?: string | null;
  breedAr?: string | null;
  sex: VetSex;
  sterilised: boolean | null;
  birthDate?: string | null;
  ageMonths?: number | null;
  weightKg?: number | null;
  microchip?: string | null;
  membership: VetMembershipStanding;
  owner: VetOwnerContact;
  alerts: VetMedicalAlert[];
  /** The tier this clinic currently holds for this cat. */
  consentTier: VetConsentTier;
  /** True when the owner narrowed the default — say so, never render a silent void. */
  restrictedByOwner: boolean;
  isOwnPatient: boolean;
  lastVisitAt?: string | null;
  insuranceFlag?: boolean;
  vaccinations?: VetVaccination[];
  weights?: VetWeightPoint[];
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

export type VetPrescriptionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

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

export type VetVisitState = "WAITING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export interface VetVisit {
  id: string;
  catId: string;
  catName: string;
  catIdNumber: string;
  catPhotoUrl: string | null;
  ownerName?: string | null;
  branchId?: string | null;
  branchNameEn?: string | null;
  branchNameAr?: string | null;
  state: VetVisitState;
  reasonEn?: string | null;
  reasonAr?: string | null;
  checkedInAt: string;
  startedAt?: string | null;
  closedAt?: string | null;
  assignedStaffId?: string | null;
  assignedStaffName?: string | null;
  /** Gross billing to the member, in SAR (VAT-inclusive). */
  grossAmount?: number | null;
  /** The member rate honoured on this visit, in SAR. */
  benefitHonouredAmount?: number | null;
  /** True when a clinical entry on this visit is still a draft. */
  hasOpenDraft?: boolean;
}

export interface VetVisitListResponse {
  visits: VetVisit[];
  /** Server-side totals for the queried window, when provided. */
  counts?: { open: number; completed: number };
}

export interface VetVisitQuery {
  /** ISO date (YYYY-MM-DD). Omit for the current day-book. */
  date?: string;
  state?: VetVisitState;
  branchId?: string;
  catId?: string;
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
export interface VetEmergencyPayload {
  catId: string;
  name: string;
  catIdNumber: string;
  photoUrl: string | null;
  sex: VetSex;
  ageMonths?: number | null;
  weightKg?: number | null;
  microchip?: string | null;
  alerts: VetMedicalAlert[];
  owner: VetOwnerContact;
  /** Recorded against the actor; the owner is notified. */
  accessId: string;
  accessedAt: string;
  reason: string;
}

export interface VetEmergencyRequest {
  /** Any exact identifier: Cat ID number, microchip, or QR token. */
  identifier: string;
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

export interface VetInviteResult {
  orgId: string;
  orgNameEn: string;
  orgNameAr: string;
  role: VetRole;
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
        if (current && list.some((m) => m.orgId === current)) return current;
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(ORG_STORAGE_KEY);
        } catch {
          /* ignore */
        }
        if (stored && list.some((m) => m.orgId === stored)) return stored;
        // Prefer a clinic the person can actually work in today.
        const usable = list.find((m) => m.status === "ACTIVE") ?? list[0];
        return usable?.orgId ?? null;
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
    const org = memberships.find((m) => m.orgId === orgId);
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
    () => memberships.find((m) => m.orgId === orgId) ?? null,
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
  getPatientTimeline: (catId: string) => Promise<{ entries: VetTimelineEntry[] }>;
  /** GET /vet/patients/:catId/prescriptions */
  getPatientPrescriptions: (catId: string) => Promise<{ prescriptions: VetPrescription[] }>;
  /** GET /vet/patients/:catId/weights */
  getPatientWeights: (catId: string) => Promise<{ points: VetWeightPoint[] }>;
  /** GET /vet/patients — the clinic's own browsable patient memory. */
  listPatients: (params?: { q?: string; cursor?: string }) => Promise<{
    patients: VetSearchResult[];
    nextCursor?: string | null;
  }>;
  /** GET /vet/visits?date=&state= — the day-book. */
  listVisits: (query?: VetVisitQuery) => Promise<VetVisitListResponse>;
  /** GET /vet/visits/:id */
  getVisit: (id: string) => Promise<VetVisit>;
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
  /** POST /vet/emergency — break-glass, always against a stated reason. */
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

      searchPatients: (q, opts) =>
        vetFetch<VetSearchResponse>(`/vet/patients/search?q=${encodeURIComponent(q)}`, {
          signal: opts?.signal,
        }),

      getPatient: (catId) => vetFetch<VetPatientProfile>(`/vet/patients/${encodeURIComponent(catId)}`),

      getPatientTimeline: (catId) =>
        vetFetch<{ entries: VetTimelineEntry[] }>(`/vet/patients/${encodeURIComponent(catId)}/timeline`),

      getPatientPrescriptions: (catId) =>
        vetFetch<{ prescriptions: VetPrescription[] }>(
          `/vet/patients/${encodeURIComponent(catId)}/prescriptions`,
        ),

      getPatientWeights: (catId) =>
        vetFetch<{ points: VetWeightPoint[] }>(`/vet/patients/${encodeURIComponent(catId)}/weights`),

      listPatients: (params) => {
        const qs = new URLSearchParams();
        if (params?.q) qs.set("q", params.q);
        if (params?.cursor) qs.set("cursor", params.cursor);
        const suffix = qs.toString();
        return vetFetch(`/vet/patients${suffix ? `?${suffix}` : ""}`);
      },

      listVisits: (query) => {
        const qs = new URLSearchParams();
        if (query?.date) qs.set("date", query.date);
        if (query?.state) qs.set("state", query.state);
        if (query?.branchId) qs.set("branchId", query.branchId);
        if (query?.catId) qs.set("catId", query.catId);
        const suffix = qs.toString();
        return vetFetch<VetVisitListResponse>(`/vet/visits${suffix ? `?${suffix}` : ""}`);
      },

      getVisit: (id) => vetFetch<VetVisit>(`/vet/visits/${encodeURIComponent(id)}`),

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

      emergencyLookup: (input) =>
        vetFetch<VetEmergencyPayload>("/vet/emergency", {
          method: "POST",
          body: JSON.stringify(input),
        }),

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
  switch (state) {
    case "WAITING":
      return isAr ? "في الانتظار" : "Waiting";
    case "IN_PROGRESS":
      return isAr ? "جارية" : "In progress";
    case "COMPLETED":
      return isAr ? "مكتملة" : "Completed";
    default:
      return isAr ? "ملغاة" : "Cancelled";
  }
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
export function vetOrgName(m: Pick<VetMembership, "orgNameAr" | "orgNameEn"> | null, isAr: boolean): string {
  if (!m) return "";
  return (isAr ? m.orgNameAr : m.orgNameEn) || m.orgNameEn || m.orgNameAr;
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
