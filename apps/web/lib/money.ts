/**
 * One way to render money, everywhere (R110) — thin wrappers over the shared
 * formatter in @moraqat/core: Western digits in both languages, «ر.س» / "SAR",
 * halalas only when there are some. Kept as `isAr`-taking helpers so the many
 * existing call sites read unchanged.
 */

import {
  formatAmount as coreAmount,
  formatSAR as coreSAR,
  formatSARMonthly as coreSARMonthly,
  SAR_SYMBOL_AR,
  SAR_SYMBOL_EN,
} from "@moraqat/core";
import { formatDate } from "./datetime";

export const SAR_AR = SAR_SYMBOL_AR;
export const SAR_EN = SAR_SYMBOL_EN;

/** Digits for an amount (no currency unit). */
export function formatAmount(amount: number, isAr: boolean): string {
  return coreAmount(amount, isAr ? "ar" : "en");
}

/** "199 ر.س" / "SAR 199". `isolate` keeps amount + unit atomic inside opposite-direction text. */
export function formatSAR(amount: number, isAr: boolean, opts?: { isolate?: boolean }): string {
  return coreSAR(amount, isAr ? "ar" : "en", opts);
}

/** "329 ر.س / شهرياً" / "SAR 329 / month". */
export function formatSARMonthly(amount: number, isAr: boolean): string {
  return coreSARMonthly(amount, isAr ? "ar" : "en");
}

/** Long date for money surfaces — same calendar as every other date (R110). */
export function formatMoneyDate(d: Date | string, isAr: boolean): string {
  return formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "long", year: "numeric" });
}
