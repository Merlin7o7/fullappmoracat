/**
 * Platform-wide date formatting with an intentional calendar preference.
 *
 * Saudi audiences may expect Hijri (Umm al-Qura) or Gregorian dates; before,
 * `ar-SA` silently defaulted to Hijri while `en-GB` was Gregorian, so the same
 * record showed two different dates by language with no way to choose. Now the
 * preference is explicit and consistent everywhere, because every surface routes
 * through this module.
 *
 * The choice is a module singleton (mirrored into `<html data-calendar>` and set
 * by the LocaleProvider from the persisted preference), so formatting helpers
 * don't need the value threaded through every call site — they read the current
 * preference here.
 */
export type CalendarPref = "auto" | "gregorian" | "hijri";
export type UiLocale = "ar" | "en";

export const CALENDAR_STORAGE_KEY = "moraqat.calendar";

let currentCalendar: CalendarPref = "auto";

export function setCurrentCalendar(pref: CalendarPref): void {
  currentCalendar = pref;
}
export function getCurrentCalendar(): CalendarPref {
  return currentCalendar;
}

/**
 * Resolve a BCP-47 locale with the right `-u-ca-` calendar extension.
 * `auto` → Hijri for Arabic, Gregorian for English (the localized default).
 */
export function dateLocale(locale: UiLocale, pref: CalendarPref = currentCalendar): string {
  const base = locale === "ar" ? "ar-SA" : "en-GB";
  const calendar =
    pref === "hijri"
      ? "islamic-umalqura"
      : pref === "gregorian"
        ? "gregory"
        : locale === "ar"
          ? "islamic-umalqura"
          : "gregory";
  return `${base}-u-ca-${calendar}`;
}

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

export function formatDate(
  value: string | Date,
  locale: UiLocale,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS
): string {
  return new Date(value).toLocaleDateString(dateLocale(locale), opts);
}

export function formatDateTime(
  value: string | Date,
  locale: UiLocale,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
): string {
  return new Date(value).toLocaleString(dateLocale(locale), opts);
}

/**
 * A count of months in grammatically-correct AR/EN — never "1 أشهر" or
 * "1 months" (R110: real localisation, not templated English). Arabic uses the
 * dual (شهرين) and the 3–10 plural (أشهر) vs. 11+ (شهراً); English is a simple
 * singular/plural. Covers every term option (1, 3, 6, 12).
 */
export function monthsLabel(n: number, locale: UiLocale): string {
  if (locale !== "ar") return `${n} ${n === 1 ? "month" : "months"}`;
  if (n === 1) return "شهر واحد";
  if (n === 2) return "شهرين";
  if (n <= 10) return `${n} أشهر`;
  return `${n} شهراً`;
}

/** Just the AR/EN unit word for a month count (for "12 | months" split labels). */
export function monthUnit(n: number, locale: UiLocale): string {
  if (locale !== "ar") return n === 1 ? "month" : "months";
  return n === 1 ? "شهر" : "أشهر";
}

/**
 * "3 days ago" / "قبل ٣ أيام" — via Intl.RelativeTimeFormat, so the plural and
 * the numerals are the language's own, not a template with English grammar
 * (R110). Used where recency is the fact that matters more than the date: a
 * lost-cat notice, a message on a board, an enquiry waiting for an answer.
 *
 * Deliberately calendar-agnostic: "two days ago" means the same thing in Hijri
 * and Gregorian, so this never needs the calendar preference.
 */
export function relativeTime(value: string | Date, isAr: boolean): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(isAr ? "ar" : "en", { numeric: "auto" });

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  const abs = Math.abs(seconds);
  for (const [unit, size] of units) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  // Under a minute reads better as a phrase than as "in 0 seconds".
  return isAr ? "الآن" : "just now";
}
