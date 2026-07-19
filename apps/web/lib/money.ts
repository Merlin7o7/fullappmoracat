/**
 * One way to render money, everywhere (R110). Before this, "SAR" rendered three
 * different ways — Latin "SAR" inside Arabic sentences, raw numbers without
 * locale digits, and ad-hoc `isAr ? "ر.س" : "SAR"` ternaries. Every price the
 * member sees goes through here: Arabic gets Arabic-Indic digits + «ر.س»,
 * English gets Latin digits + "SAR", and the digit run is always LTR-safe.
 */

import { dateLocale } from "./datetime";

export const SAR_AR = "ر.س";
export const SAR_EN = "SAR";

/** Locale-correct digits for an amount (no currency unit). */
export function formatAmount(amount: number, isAr: boolean): string {
  return new Intl.NumberFormat(isAr ? "ar-SA" : "en-US", {
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * "١٢٩ ر.س" / "129 SAR". Plain string — safe anywhere. For JSX contexts inside
 * RTL text where bidi could reorder, wrap in a `dir="ltr"` span or use the
 * `⁦…⁩` isolates this returns when `isolate` is set.
 */
export function formatSAR(amount: number, isAr: boolean, opts?: { isolate?: boolean }): string {
  const n = formatAmount(amount, isAr);
  const s = isAr ? `${n} ${SAR_AR}` : `${n} ${SAR_EN}`;
  // FIRST-STRONG-ISOLATE keeps the amount+unit atomic inside surrounding RTL text.
  return opts?.isolate ? `⁨${s}⁩` : s;
}

/** "249 SAR / month" / "٢٤٩ ر.س / شهرياً". */
export function formatSARMonthly(amount: number, isAr: boolean): string {
  return isAr ? `${formatSAR(amount, true)} / شهرياً` : `${formatSAR(amount, false)} / month`;
}

/**
 * Localized long date for money surfaces (renewal/term dates). Routes through
 * the member's calendar preference (lib/datetime) so a Hijri-pref member sees
 * one calendar EVERYWHERE — never a Hijri "paid through" beside a Gregorian
 * delivery date on the same card (R110).
 */
export function formatMoneyDate(d: Date | string, isAr: boolean): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString(dateLocale(isAr ? "ar" : "en"), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
