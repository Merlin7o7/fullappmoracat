/**
 * The veterinary API contract, shared verbatim by the NestJS services and the
 * clinic portal.
 *
 * This exists because the portal was written against a *specification* of the
 * backend rather than the backend itself. The two disagreed on enum values,
 * field names and envelope shapes on nearly every endpoint — a closed visit
 * arrived as `CLOSED` while the UI tested for `COMPLETED`, so the check was
 * permanently false and a vet could type a full SOAP note into a chart that
 * refused to save. Because the fetch helper cast responses without validating
 * them, none of it threw: screens simply rendered blank.
 *
 * Types alone cannot prevent that (the web had types — they were just wrong).
 * The rule is that BOTH sides import these, so a change breaks the build rather
 * than the clinic.
 */

// ── Enumerations (mirror the Prisma enums exactly) ─────────────────────────

/** A visit is open or closed. There is no in-progress/waiting state. */
export const VISIT_STATES = ["OPEN", "CLOSED"] as const;
export type VisitState = (typeof VISIT_STATES)[number];

export const PRESCRIPTION_STATUSES = [
  "ISSUED",
  "COLLECTED",
  "REFILLED",
  "COMPLETED",
  "EXPIRED",
  "CANCELLED",
] as const;
export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const CLINICAL_ENTRY_STATUSES = ["DRAFT", "FINAL", "AMENDED", "RETRACTED"] as const;
export type ClinicalEntryStatus = (typeof CLINICAL_ENTRY_STATUSES)[number];

export const CONSENT_TIERS = ["T0", "T1", "T2"] as const;
export type ConsentTier = (typeof CONSENT_TIERS)[number];

// ── Envelopes ─────────────────────────────────────────────────────────────

/**
 * Every paginated vet endpoint returns this shape. The portal previously
 * expected a differently-named array per endpoint (`entries`, `points`,
 * `prescriptions`, `visits`), none of which the API ever sent.
 */
export interface Paginated<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

/** What a clinic may currently see of this cat, attached to record reads. */
export interface AccessContext {
  tier: ConsentTier;
  grantedAt?: string | null;
  expiresAt?: string | null;
  emergencyOnly?: boolean;
}

export type RecordList<T> = Paginated<T> & { access: AccessContext };

// ── Runtime validation ────────────────────────────────────────────────────

/**
 * Assert a response actually has the keys we are about to read.
 *
 * A raw `as T` cast is what let the contract drift silently for an entire
 * platform: the data was wrong, nothing threw, and the failure surfaced as an
 * empty screen in a clinic. Failing loudly here turns a silent blank into a
 * fixable error with the endpoint named.
 */
export function assertShape<T>(value: unknown, keys: readonly string[], context: string): T {
  if (value === null || typeof value !== "object") {
    throw new Error(
      `${context}: expected an object from the API, received ${value === null ? "null" : typeof value}.`
    );
  }
  const missing = keys.filter((k) => !(k in (value as Record<string, unknown>)));
  if (missing.length) {
    throw new Error(
      `${context}: API response is missing ${missing.map((m) => `"${m}"`).join(", ")}. ` +
        `Received keys: ${Object.keys(value as Record<string, unknown>).join(", ") || "(none)"}. ` +
        `This is a client/server contract mismatch, not a data problem.`
    );
  }
  return value as T;
}

/** Narrow an unknown value to a known enum member, or fail with context. */
export function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  context: string
): T {
  if (typeof value === "string" && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new Error(
    `${context}: expected one of ${allowed.join(" | ")}, received ${JSON.stringify(value)}.`
  );
}
