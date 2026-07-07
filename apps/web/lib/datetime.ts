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
