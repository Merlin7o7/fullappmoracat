/**
 * Visits, counter sessions, owner delivery and staff licensing — the rest of
 * the clinic contract (MRC-VET-001 §02/§09), shared by the API and the portal.
 *
 * Reasons are stored as CODES and rendered per locale. They used to be stored
 * as English prose, so an Arabic owner's emergency notification read
 * «السبب المُعلن: Collapse / unresponsive» (UX audit 2026-10-04, #vet P2).
 * Free text is still accepted everywhere a code is — older rows and genuine
 * "other" reasons render verbatim.
 */

import type { VetRole } from "./vet-permissions";

type Locale = "ar" | "en";
type Label = { ar: string; en: string };

// ── Visit reasons ─────────────────────────────────────────────────────────

export const VET_VISIT_REASONS = [
  "checkup",
  "vaccination",
  "illness",
  "follow-up",
  "emergency",
  "surgery",
  "dental",
  "sterilisation",
  "grooming",
  "other",
] as const;
export type VetVisitReason = (typeof VET_VISIT_REASONS)[number];

export const VET_VISIT_REASON_LABELS: Record<VetVisitReason, Label> = {
  checkup: { ar: "فحص دوري", en: "Check-up" },
  vaccination: { ar: "تطعيم", en: "Vaccination" },
  illness: { ar: "أعراض مرضية", en: "Illness" },
  "follow-up": { ar: "متابعة", en: "Follow-up" },
  emergency: { ar: "طوارئ", en: "Emergency" },
  surgery: { ar: "جراحة / إجراء", en: "Surgery / procedure" },
  dental: { ar: "أسنان", en: "Dental" },
  sterilisation: { ar: "تعقيم", en: "Spay / neuter" },
  grooming: { ar: "عناية وتنظيف", en: "Grooming" },
  other: { ar: "أخرى", en: "Other" },
};

/** Why an EMPTY visit is closing (a visit with entries needs no reason). */
export const VET_CLOSE_EMPTY_REASONS = ["no-show", "consult-only", "referred", "other"] as const;
export type VetCloseEmptyReason = (typeof VET_CLOSE_EMPTY_REASONS)[number];

export const VET_CLOSE_EMPTY_REASON_LABELS: Record<VetCloseEmptyReason, Label> = {
  "no-show": { ar: "لم يحضر", en: "Didn't attend" },
  "consult-only": { ar: "استشارة فقط", en: "Consultation only" },
  referred: { ar: "أُحيل لعيادة أخرى", en: "Referred to another clinic" },
  other: { ar: "أخرى", en: "Other" },
};

/** Break-glass presets. */
export const VET_EMERGENCY_REASONS = [
  "COLLAPSE",
  "TRAUMA",
  "BREATHING",
  "SEIZURE",
  "POISONING",
  "URINARY",
  "BLEEDING",
  "OTHER",
] as const;
export type VetEmergencyReason = (typeof VET_EMERGENCY_REASONS)[number];

export const VET_EMERGENCY_REASON_LABELS: Record<VetEmergencyReason, Label> = {
  COLLAPSE: { ar: "انهيار / فقدان وعي", en: "Collapse / unresponsive" },
  TRAUMA: { ar: "إصابة أو حادث", en: "Trauma or accident" },
  BREATHING: { ar: "ضيق تنفّس", en: "Respiratory distress" },
  SEIZURE: { ar: "تشنّج", en: "Seizure" },
  POISONING: { ar: "اشتباه تسمّم", en: "Suspected poisoning" },
  URINARY: { ar: "انسداد بولي", en: "Urinary obstruction" },
  BLEEDING: { ar: "نزيف", en: "Bleeding" },
  OTHER: { ar: "أخرى", en: "Other" },
};

/** "CODE" or "CODE — detail" on the wire; anything else is free text. */
const CODED = /^([A-Za-z][A-Za-z_-]*)(?:\s+—\s+([\s\S]+))?$/;

/** Compose a stored reason from a code and optional typed detail. */
export function composeReason(code: string | null | undefined, detail?: string | null): string {
  const d = (detail ?? "").trim();
  const c = (code ?? "").trim();
  if (!c) return d;
  return d ? `${c} — ${d}` : c;
}

function renderCoded<K extends string>(
  stored: string | null | undefined,
  labels: Record<K, Label>,
  locale: Locale
): string {
  const s = (stored ?? "").trim();
  if (!s) return "";
  const m = CODED.exec(s);
  if (m) {
    const key = (Object.keys(labels) as K[]).find((k) => k.toLowerCase() === m[1]!.toLowerCase());
    if (key) {
      const label = labels[key][locale];
      // "Other — <detail>" reads as just the detail.
      if (m[2]) return key.toLowerCase() === "other" ? m[2].trim() : `${label} — ${m[2].trim()}`;
      return label;
    }
  }
  return s;
}

/**
 * A visit reason, in the reader's language (codes) or verbatim (free text).
 * An empty visit closed with a reason stores "<arrival> · <closing>"; each
 * segment renders on its own ("vaccination · no-show" → «تطعيم · لم يحضر»).
 */
export function visitReasonLabel(stored: string | null | undefined, locale: Locale): string {
  const labels = { ...VET_VISIT_REASON_LABELS, ...VET_CLOSE_EMPTY_REASON_LABELS };
  return (stored ?? "")
    .split(" · ")
    .map((part) => renderCoded(part, labels, locale))
    .filter(Boolean)
    .join(" · ");
}

/** A break-glass reason, in the reader's language. */
export function emergencyReasonLabel(stored: string | null | undefined, locale: Locale): string {
  return renderCoded(stored, VET_EMERGENCY_REASON_LABELS, locale);
}

// ── Visit envelopes ───────────────────────────────────────────────────────

export const VET_VISIT_MODES = ["QUICK", "STANDARD", "EMERGENCY"] as const;
export type VetVisitMode = (typeof VET_VISIT_MODES)[number];

export interface VetOpenVisitRequest {
  catId: string;
  mode?: VetVisitMode;
  /** A `VET_VISIT_REASONS` code, or free text. */
  reason?: string;
  branchId?: string;
  presentingComplaint?: string;
  /** Return the cat's existing OPEN visit instead of a 409. */
  resumeExisting?: boolean;
}

export interface VetOpenVisitResponse<V = unknown> {
  visit: V;
  /** True when an already-open visit was returned rather than a new one. */
  resumed: boolean;
}

export interface VetCloseVisitRequest {
  /** Required when the visit has no entries: a `VET_CLOSE_EMPTY_REASONS` code or text. */
  reason?: string;
  followUpAt?: string;
}

export interface VetCloseVisitResponse<V = unknown> {
  visit: V;
  /** Trainee drafts still awaiting a co-signature on this visit. */
  pendingCoSign: number;
  nextStep: { action: string; ar: string; en: string } | null;
}

/** The 409 the API returns when a cat already has an open visit here. */
export const VET_VISIT_OPEN_EXISTS = "VET_VISIT_OPEN_EXISTS";

/**
 * Is an OPEN visit left over from an earlier Riyadh day? Such visits stay in
 * the queue (they used to vanish at midnight UTC) and say so.
 */
export function isStaleOpenVisit(
  visit: { state: string; checkedInAt: Date | string },
  todayStart: Date
): boolean {
  if (visit.state !== "OPEN") return false;
  const at = new Date(visit.checkedInAt).getTime();
  return Number.isFinite(at) && at < todayStart.getTime();
}

// ── Counter mode ──────────────────────────────────────────────────────────

/** Header carrying the active clinic. */
export const VET_ORG_HEADER = "x-moracat-org";
/** Header carrying a PIN-unlocked counter session token. */
export const VET_COUNTER_HEADER = "x-moracat-counter";

export interface VetCounterUnlockRequest {
  deviceId: string;
  staffId: string;
  pin: string;
}

/** Exactly what POST /vet/auth/counter/unlock returns. */
export interface VetCounterSessionResponse {
  counterToken: string;
  expiresAt: string;
  header: { name: string; value: string };
  device: { id: string; name: string; branchId: string };
  actor: {
    staffId: string;
    orgId: string;
    role: VetRole;
    roleLabel: Label;
    title: string | null;
    name: string | null;
    avatarUrl: string | null;
    counterMode: true;
    capabilities: string[];
    /** The PIN'd person's licence standing — the server applies it to every write. */
    licence?: LicenceStanding;
  };
}

// ── Owner delivery ────────────────────────────────────────────────────────

/**
 * What actually happened when the API tried to tell an owner something. The
 * portal used to say "owner notified" whatever happened — including for cats
 * nobody has claimed yet, where there is no owner to tell.
 */
export interface VetOwnerDelivery {
  delivered: boolean;
  /** The channel it went out on; null when nothing was sent. */
  channel: "IN_APP" | null;
  /** Why not, when not delivered. */
  reason?: "UNCLAIMED" | "FAILED" | null;
}

/** Bilingual copy for an undelivered owner message — said at the counter. */
export function ownerDeliveryNotice(d: VetOwnerDelivery): Label | null {
  if (d.delivered) return null;
  if (d.reason === "UNCLAIMED") {
    return {
      ar: "هذا القط ما استُلم بعد — اعرضوا رمز الاستلام أولاً.",
      en: "This cat hasn't been claimed yet — show the claim code first.",
    };
  }
  return {
    ar: "تعذّر إيصال الرسالة للمالك. أخبروه مباشرةً في العيادة.",
    en: "The message couldn't reach the owner. Tell them directly at the clinic.",
  };
}

// ── Practitioner licences ─────────────────────────────────────────────────

/**
 * Roles whose matrix includes prescribing / co-signing, and so must hold a
 * practitioner licence to use them. OWNER is here because an owner holds the
 * full clinical set; a non-practising owner has no licence on file.
 */
export const LICENSED_VET_ROLES: readonly VetRole[] = ["OWNER", "VET_SENIOR", "VET"];

/** Roles whose INVITATION must carry a licence number and expiry. */
export const LICENCE_ON_INVITE_ROLES: readonly VetRole[] = ["VET_SENIOR", "VET"];

export function roleRequiresLicence(role: VetRole): boolean {
  return LICENSED_VET_ROLES.includes(role);
}

export type LicenceStanding = "NOT_REQUIRED" | "VALID" | "MISSING" | "EXPIRED";

/**
 * Whether a staff member's practitioner licence lets them act as a doctor.
 *
 * Moracat holds no separate per-person verification record yet, so this is
 * what the data can honestly say: a licence number is on file and its expiry,
 * when recorded, has not passed. New doctor invitations must carry both (the
 * API refuses them otherwise). Until a licence is on file, the person's
 * prescribing and co-signing are held and their records save as drafts for a
 * licensed colleague to co-sign — see `capabilitiesFor` / `requiresCoSign`.
 */
export function licenceStanding(
  input: { role: VetRole; licenceNo?: string | null; licenceExpiresAt?: Date | string | null },
  now: Date = new Date()
): LicenceStanding {
  if (!roleRequiresLicence(input.role)) return "NOT_REQUIRED";
  if (!input.licenceNo?.trim()) return "MISSING";
  if (input.licenceExpiresAt) {
    const exp = new Date(input.licenceExpiresAt).getTime();
    if (!Number.isFinite(exp) || exp <= now.getTime()) return "EXPIRED";
  }
  return "VALID";
}

/** Bilingual explanation of a held licence, for the portal and the API error. */
export function licenceHoldNotice(standing: LicenceStanding): Label | null {
  if (standing === "MISSING") {
    return {
      ar: "لا يوجد رقم ترخيص مزاولة مسجّل لك في هذه العيادة. ما تكتبه يُحفظ كمسودة يوقّعها طبيب مرخّص، والوصفات موقوفة حتى يسجّل مدير العيادة ترخيصك.",
      en: "No practitioner licence is on file for you at this clinic. What you write saves as a draft for a licensed colleague to co-sign, and prescribing is held until a manager records your licence.",
    };
  }
  if (standing === "EXPIRED") {
    return {
      ar: "انتهت صلاحية ترخيص المزاولة المسجّل لك. ما تكتبه يُحفظ كمسودة، والوصفات موقوفة حتى يُحدَّث الترخيص.",
      en: "Your practitioner licence on file has expired. What you write saves as a draft, and prescribing is held until it's renewed.",
    };
  }
  return null;
}
