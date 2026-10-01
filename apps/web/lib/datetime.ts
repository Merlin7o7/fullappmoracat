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
import {
  formatDate as coreFormatDate,
  formatMonths,
  formatRelative,
  type CalendarChoice,
} from "@moraqat/core";

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

/** The calendar a preference resolves to. Gregorian unless the member chose Hijri. */
export function calendarFor(pref: CalendarPref = currentCalendar): CalendarChoice {
  return pref === "hijri" ? "hijri" : "gregorian";
}

/**
 * BCP-47 locale with the calendar AND the one digit system (Western) baked in,
 * for the few call sites that still hand a locale string to Intl directly.
 * `auto` now means Gregorian in both languages — Hijri is an explicit choice
 * (UX reassessment kill list: "Hijri-by-default → Gregorian default, Hijri opt-in").
 */
export function dateLocale(locale: UiLocale, pref: CalendarPref = currentCalendar): string {
  const ca = calendarFor(pref) === "hijri" ? "islamic-umalqura" : "gregory";
  return locale === "ar" ? `ar-SA-u-ca-${ca}-nu-latn` : `en-GB-u-ca-${ca}`;
}

const DEFAULT_DATE_OPTS: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };

/** Every date in the web app — delegates to @moraqat/core with the member's calendar. */
export function formatDate(
  value: string | Date,
  locale: UiLocale,
  opts: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTS
): string {
  return coreFormatDate(value, locale, opts, calendarFor());
}

export function formatDateTime(
  value: string | Date,
  locale: UiLocale,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
): string {
  return coreFormatDate(value, locale, opts, calendarFor());
}

/**
 * A count of months in grammatically-correct AR/EN — never "1 أشهر" or
 * "1 months" (R110: real localisation, not templated English). Arabic uses the
 * dual (شهرين) and the 3–10 plural (أشهر) vs. 11+ (شهراً); English is a simple
 * singular/plural. Covers every term option (1, 3, 6, 12).
 */
export function monthsLabel(n: number, locale: UiLocale): string {
  return n === 1 ? (locale === "ar" ? "شهر واحد" : "1 month") : formatMonths(n, locale);
}

/** Just the AR/EN unit word for a month count (for "12 | months" split labels). */
export function monthUnit(n: number, locale: UiLocale): string {
  if (locale !== "ar") return n === 1 ? "month" : "months";
  return n === 1 ? "شهر" : "أشهر";
}

/**
 * "3 days ago" / "قبل 3 أيام" — via Intl.RelativeTimeFormat, so the plural and
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
  // Under a minute reads better as a phrase than as "in 0 minutes".
  if (Math.abs(then - Date.now()) < 60_000) return isAr ? "الآن" : "just now";
  return formatRelative(value, isAr ? "ar" : "en");
}
