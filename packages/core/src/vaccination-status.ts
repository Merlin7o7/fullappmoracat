/**
 * Vaccination standing, derived — never stored as a claim.
 *
 * The clinical write path used to set `Cat.vaccinationStatus = "UP_TO_DATE"`
 * unconditionally on ANY vaccination entry, and nothing ever recomputed it. Two
 * consequences, both member-facing:
 *
 *   * One dose of a three-dose kitten series flipped the Cat ID badge to
 *     "up to date" while the kitten was, clinically, not.
 *   * When `dueAt` passed, the badge stayed green forever. The status was only
 *     ever true at the instant it was written.
 *
 * Deriving from the records at read time means the badge cannot drift from the
 * facts, because it IS the facts. A stored status can lie; a computed one
 * cannot.
 */

export type VaccinationStanding = "UP_TO_DATE" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";

export interface VaccinationRecord {
  /** When the dose was given. */
  administeredAt: Date | string | null;
  /** When the next dose is due, if the clinician recorded one. */
  dueAt: Date | string | null;
}

export interface VaccinationDerivation {
  standing: VaccinationStanding;
  /** The soonest future due date across all records, if any. */
  nextDueAt: Date | null;
  /** The most overdue date, if anything has lapsed. */
  overdueSince: Date | null;
  /** Days until the next dose; negative when overdue. */
  daysUntilDue: number | null;
}

const DAY_MS = 86_400_000;

/** A dose inside this window is "due soon" rather than merely scheduled. */
export const DUE_SOON_DAYS = 30;

function toDate(v: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function deriveVaccinationStatus(
  records: readonly VaccinationRecord[],
  now: Date = new Date()
): VaccinationDerivation {
  const dues = records.map((r) => toDate(r.dueAt)).filter((d): d is Date => d !== null);
  const hasAnyDose = records.some((r) => toDate(r.administeredAt) !== null);

  // No due dates recorded at all. If doses exist we know *something* was given
  // but cannot honestly claim currency — the clinician did not say when the
  // next one falls, so neither will we.
  if (!dues.length) {
    return {
      standing: hasAnyDose ? "UNKNOWN" : "UNKNOWN",
      nextDueAt: null,
      overdueSince: null,
      daysUntilDue: null,
    };
  }

  const overdue = dues.filter((d) => d.getTime() < now.getTime());
  const upcoming = dues
    .filter((d) => d.getTime() >= now.getTime())
    .sort((a, b) => a.getTime() - b.getTime());

  if (overdue.length) {
    const oldest = overdue.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b));
    return {
      standing: "OVERDUE",
      nextDueAt: upcoming[0] ?? null,
      overdueSince: oldest,
      daysUntilDue: Math.ceil((oldest.getTime() - now.getTime()) / DAY_MS),
    };
  }

  const next = upcoming[0]!;
  const days = Math.ceil((next.getTime() - now.getTime()) / DAY_MS);
  return {
    standing: days <= DUE_SOON_DAYS ? "DUE_SOON" : "UP_TO_DATE",
    nextDueAt: next,
    overdueSince: null,
    daysUntilDue: days,
  };
}

/** Bilingual label. Colour is never the only signal (R093). */
export function vaccinationStandingLabel(
  standing: VaccinationStanding
): { ar: string; en: string } {
  switch (standing) {
    case "UP_TO_DATE":
      return { ar: "التطعيمات محدّثة", en: "Vaccinations up to date" };
    case "DUE_SOON":
      return { ar: "تطعيم قريب", en: "Vaccination due soon" };
    case "OVERDUE":
      return { ar: "تطعيم متأخر", en: "Vaccination overdue" };
    default:
      return { ar: "التطعيمات غير مسجّلة", en: "Vaccinations not recorded" };
  }
}
