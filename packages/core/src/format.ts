/**
 * One formatter for every number, sum of money, date and age Moracat shows
 * (R110, MRC-BRAND-001 §type).
 *
 * Before this file there were nine: money in Arabic-Indic digits, the census
 * counter and the vet portal in Western digits, Hijri by default in one place
 * and Gregorian in the next — so one card could print "129 ر.س" beside
 * "Cat #86" beside a Hijri renewal date. The rules, decided once:
 *
 *   • DIGITS — Western (0–9) in both languages. Cat IDs, serials, phone numbers
 *     and prices are identifiers people copy and compare; one digit system
 *     makes them recognisable at a glance. Arabic text keeps Arabic words.
 *   • CALENDAR — Gregorian by default in both languages; Hijri (Umm al-Qura)
 *     only when the member chooses it.
 *   • MONEY — "199 ر.س" / "SAR 199", whole riyals unless there are halalas.
 *   • GRAMMAR — Arabic counts use the dual and the 3–10 / 11+ plural forms.
 *
 * Platform-free (Intl only) so the API, the web and emails share it.
 */

export type FormatLocale = "ar" | "en";
export type CalendarChoice = "gregorian" | "hijri";

/** The one digit system (see header). */
export const DIGITS = "latn" as const;

function numberLocale(locale: FormatLocale): string {
  return locale === "ar" ? `ar-SA-u-nu-${DIGITS}` : "en-US";
}

function dateLocaleTag(locale: FormatLocale, calendar: CalendarChoice): string {
  const ca = calendar === "hijri" ? "islamic-umalqura" : "gregory";
  return locale === "ar" ? `ar-SA-u-ca-${ca}-nu-${DIGITS}` : `en-GB-u-ca-${ca}`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

// ── Numbers ───────────────────────────────────────────────────────────────

export function formatNumber(n: number, locale: FormatLocale, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    maximumFractionDigits: Number.isInteger(n) ? 0 : 2,
    ...opts,
  }).format(n);
}

/** 0.05 → "5%" / "5٪". */
export function formatPercent(fraction: number, locale: FormatLocale, fractionDigits = 0): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "percent",
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  }).format(fraction);
}

// ── Money ─────────────────────────────────────────────────────────────────

export const SAR_SYMBOL_AR = "ر.س";
export const SAR_SYMBOL_EN = "SAR";

/** Digits only, no unit: 199 / 1,248.30. */
export function formatAmount(amount: number, locale: FormatLocale): string {
  return new Intl.NumberFormat(numberLocale(locale), {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/**
 * "199 ر.س" / "SAR 199". With `isolate`, wrapped in FIRST-STRONG-ISOLATE so the
 * amount and its unit never get reordered inside the opposite direction's text.
 */
export function formatSAR(amount: number, locale: FormatLocale, opts: { isolate?: boolean } = {}): string {
  const n = formatAmount(amount, locale);
  const s = locale === "ar" ? `${n} ${SAR_SYMBOL_AR}` : `${SAR_SYMBOL_EN} ${n}`;
  return opts.isolate ? `⁨${s}⁩` : s;
}

export function formatSARMonthly(amount: number, locale: FormatLocale): string {
  return locale === "ar" ? `${formatSAR(amount, "ar")} / شهرياً` : `${formatSAR(amount, "en")} / month`;
}

// ── Dates ─────────────────────────────────────────────────────────────────

export type DateStyle = "short" | "medium" | "long" | "numeric" | "monthYear" | "dayMonth";

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: "numeric", month: "short", year: "numeric" },
  medium: { day: "numeric", month: "long", year: "numeric" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric" },
  numeric: { day: "2-digit", month: "2-digit", year: "numeric" },
  monthYear: { month: "long", year: "numeric" },
  dayMonth: { day: "numeric", month: "long" },
};

export function formatDate(
  value: Date | string | number,
  locale: FormatLocale,
  style: DateStyle | Intl.DateTimeFormatOptions = "short",
  calendar: CalendarChoice = "gregorian"
): string {
  const opts = typeof style === "string" ? DATE_STYLES[style] : style;
  return new Intl.DateTimeFormat(dateLocaleTag(locale, calendar), opts).format(toDate(value));
}

export function formatDateTime(
  value: Date | string | number,
  locale: FormatLocale,
  calendar: CalendarChoice = "gregorian"
): string {
  return new Intl.DateTimeFormat(dateLocaleTag(locale, calendar), {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(toDate(value));
}

/** The Hijri date on its own, e.g. as a secondary line under a Gregorian date. */
export function formatHijri(value: Date | string | number, locale: FormatLocale, style: DateStyle = "medium"): string {
  return formatDate(value, locale, style, "hijri");
}

/** "قبل 3 أيام" / "in 2 weeks" — picks the largest sensible unit. */
export function formatRelative(value: Date | string | number, locale: FormatLocale, now: Date = new Date()): string {
  const diffSec = Math.round((toDate(value).getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat(locale === "ar" ? `ar-u-nu-${DIGITS}` : "en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, secs] of units) {
    if (abs >= secs) return rtf.format(Math.round(diffSec / secs), unit);
  }
  return rtf.format(0, "minute");
}

// ── Counts with real Arabic grammar ────────────────────────────────────────

/**
 * Arabic noun forms by count: 1 → singular (no numeral), 2 → dual, 3–10 →
 * plural, 11+ → accusative singular. English: singular/plural.
 */
export function countLabel(
  n: number,
  locale: FormatLocale,
  forms: { ar: { one: string; two: string; few: string; many: string }; en: { one: string; other: string } }
): string {
  if (locale === "en") return `${formatNumber(n, "en")} ${n === 1 ? forms.en.one : forms.en.other}`;
  if (n === 1) return forms.ar.one;
  if (n === 2) return forms.ar.two;
  const num = formatNumber(n, "ar");
  return n >= 3 && n <= 10 ? `${num} ${forms.ar.few}` : `${num} ${forms.ar.many}`;
}

const MONTHS = { ar: { one: "شهر", two: "شهرين", few: "أشهر", many: "شهراً" }, en: { one: "month", other: "months" } };
const YEARS = { ar: { one: "سنة", two: "سنتين", few: "سنوات", many: "سنة" }, en: { one: "year", other: "years" } };
const WEEKS = { ar: { one: "أسبوع", two: "أسبوعين", few: "أسابيع", many: "أسبوعاً" }, en: { one: "week", other: "weeks" } };
const DAYS = { ar: { one: "يوم", two: "يومين", few: "أيام", many: "يوماً" }, en: { one: "day", other: "days" } };

export function formatMonths(n: number, locale: FormatLocale): string {
  return countLabel(n, locale, MONTHS);
}
export function formatDays(n: number, locale: FormatLocale): string {
  return countLabel(n, locale, DAYS);
}
export function formatWeeks(n: number, locale: FormatLocale): string {
  return countLabel(n, locale, WEEKS);
}

/**
 * A cat's age from whole months: "3 أشهر", "سنة وشهرين", "4 سنوات" /
 * "3 months", "1 year 2 months", "4 years". Months are dropped after 3 years —
 * nobody says "seven years and five months" about a cat.
 */
export function formatAge(months: number | null | undefined, locale: FormatLocale): string | null {
  if (months == null || !Number.isFinite(months) || months < 0) return null;
  if (months < 1) return locale === "ar" ? "أقل من شهر" : "under a month";
  if (months < 12) return countLabel(months, locale, MONTHS);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const y = countLabel(years, locale, YEARS);
  if (!rest || years >= 3) return y;
  const m = countLabel(rest, locale, MONTHS);
  return locale === "ar" ? `${y} و${m}` : `${y} ${m}`;
}

/** "4.5 كغ" / "4.5 kg" — one decimal, trailing zero dropped. */
export function formatWeight(kg: number | null | undefined, locale: FormatLocale): string | null {
  if (kg == null || !Number.isFinite(kg)) return null;
  const n = formatNumber(Math.round(kg * 10) / 10, locale, { maximumFractionDigits: 1 });
  return locale === "ar" ? `${n} كغ` : `${n} kg`;
}
