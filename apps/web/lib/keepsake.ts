/**
 * When to surface «عام {cat}» — the yearly keepsake (R065; audit 2026-10-04
 * Opportunity 9: "already built; just surface it").
 *
 * Three moments, in priority order, each only when it is true:
 *   1. the cat's birthday, within ±14 days            → this year's keepsake
 *   2. the registration anniversary (a full year on), ±14 days
 *   3. the turn of the year: 20 Dec – 15 Jan          → the year that closed
 *      (in December: the year closing now; in January: last year)
 *
 * Pure and clock-injected so it can be tested and never guesses: no birth
 * date → no birthday; registered this year → no anniversary.
 */
export type KeepsakeReason = "birthday" | "anniversary" | "yearEnd";

export interface KeepsakeMoment {
  reason: KeepsakeReason;
  /** The keepsake year to open: /portal/cats/{id}/year/{year}. */
  year: number;
  /** Signed whole days from today to the occasion (negative = it passed). */
  days: number;
}

const DAY = 86_400_000;
const WINDOW = 14;

function startOfDay(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Nearest occurrence of a month/day to `now` (last, this or next year), as signed days. */
function nearestAnniversary(source: Date, now: Date): number {
  const today = startOfDay(now);
  let best = Number.POSITIVE_INFINITY;
  for (const dy of [-1, 0, 1]) {
    const y = now.getUTCFullYear() + dy;
    // 29 Feb falls back to 28 Feb in common years.
    const month = source.getUTCMonth();
    let date = source.getUTCDate();
    const lastDay = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    if (date > lastDay) date = lastDay;
    const diff = Math.round((Date.UTC(y, month, date) - today) / DAY);
    if (Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best;
}

function parse(d: string | null | undefined): Date | null {
  if (!d) return null;
  const x = new Date(d);
  return Number.isNaN(+x) ? null : x;
}

export function keepsakeMoment(
  cat: { birthDate?: string | null; idIssuedAt?: string | null },
  now: Date = new Date()
): KeepsakeMoment | null {
  const year = now.getUTCFullYear();
  const issued = parse(cat.idIssuedAt);
  // A keepsake needs at least some record in the year it describes.
  const hasYear = (y: number) => !issued || issued.getUTCFullYear() <= y;

  const born = parse(cat.birthDate);
  if (born && born.getTime() < now.getTime()) {
    const days = nearestAnniversary(born, now);
    if (Math.abs(days) <= WINDOW && hasYear(year)) return { reason: "birthday", year, days };
  }

  if (issued && now.getTime() - issued.getTime() > 300 * DAY) {
    const days = nearestAnniversary(issued, now);
    if (Math.abs(days) <= WINDOW) return { reason: "anniversary", year, days };
  }

  const m = now.getUTCMonth();
  const d = now.getUTCDate();
  if (m === 11 && d >= 20 && hasYear(year)) return { reason: "yearEnd", year, days: 0 };
  if (m === 0 && d <= 15 && hasYear(year - 1)) return { reason: "yearEnd", year: year - 1, days: 0 };

  return null;
}

/** One honest line about the occasion, in the cat's name. */
export function keepsakeLine(m: KeepsakeMoment, name: string, isAr: boolean): string {
  const n = Math.abs(m.days);
  const when = (ar: string, en: string) => {
    if (m.days === 0) return isAr ? `${ar} اليوم` : `${en} today`;
    if (m.days > 0) return isAr ? `${ar} بعد ${dayCount(n, true)}` : `${en} in ${n} day${n === 1 ? "" : "s"}`;
    return isAr ? `${ar} قبل ${dayCount(n, true)}` : `${en} ${n} day${n === 1 ? "" : "s"} ago`;
  };
  if (m.reason === "birthday") return when(`عيد ميلاد ${name}`, `${name}'s birthday`);
  if (m.reason === "anniversary") return when(`ذكرى انضمام ${name} لسجل مرقط`, `${name}'s Moracat anniversary`);
  return isAr ? `عام ${m.year} مع ${name} صار في كتاب` : `${name}'s ${m.year}, kept in one place`;
}

/** Arabic day count with real dual/plural forms. */
function dayCount(n: number, isAr: boolean): string {
  if (!isAr) return `${n} days`;
  if (n === 1) return "يوم";
  if (n === 2) return "يومين";
  if (n >= 3 && n <= 10) return `${n} أيام`;
  return `${n} يوماً`;
}
