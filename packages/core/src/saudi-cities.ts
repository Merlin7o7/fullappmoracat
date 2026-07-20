/**
 * Where a cat lives — the census city.
 *
 * Deliberately NOT the `City` table in the database. That model is the
 * **delivery** city list: it owns DeliveryZones and Branches, and its
 * `isActive` flag is what says "we ship here". Only Riyadh and Jeddah are in
 * it, and adding Makkah so that a Makkah owner could register would silently
 * claim delivery coverage we do not have (R040).
 *
 * The census asks a different question — "how many cats live in Saudi Arabia?"
 * — and must be answerable from anywhere in the Kingdom on day one, long
 * before a single box ships. So the census city is its own static list, keyed
 * by a stable slug, and the two lists are free to disagree: you can be counted
 * in Abha years before Abha is a delivery zone.
 *
 * The slug is what persists on the cat. Renaming a label here is safe; changing
 * a slug is not — it would orphan every cat registered under the old one.
 */

export interface SaudiCity {
  /** Stable identifier persisted on the cat. Never change one in place. */
  code: string;
  ar: string;
  en: string;
}

/**
 * Major Saudi cities, ordered roughly by population so the common answers sit
 * at the top of the picker and most people never scroll (R002 — effort is the
 * enemy). Not exhaustive by design: `other` exists so nobody is ever forced to
 * claim a city they don't live in.
 */
export const SAUDI_CITIES: readonly SaudiCity[] = [
  { code: "riyadh", ar: "الرياض", en: "Riyadh" },
  { code: "jeddah", ar: "جدة", en: "Jeddah" },
  { code: "makkah", ar: "مكة المكرمة", en: "Makkah" },
  { code: "madinah", ar: "المدينة المنورة", en: "Madinah" },
  { code: "dammam", ar: "الدمام", en: "Dammam" },
  { code: "khobar", ar: "الخبر", en: "Khobar" },
  { code: "dhahran", ar: "الظهران", en: "Dhahran" },
  { code: "ahsa", ar: "الأحساء", en: "Al-Ahsa" },
  { code: "qatif", ar: "القطيف", en: "Qatif" },
  { code: "jubail", ar: "الجبيل", en: "Jubail" },
  { code: "taif", ar: "الطائف", en: "Taif" },
  { code: "buraidah", ar: "بريدة", en: "Buraidah" },
  { code: "unaizah", ar: "عنيزة", en: "Unaizah" },
  { code: "hail", ar: "حائل", en: "Hail" },
  { code: "tabuk", ar: "تبوك", en: "Tabuk" },
  { code: "abha", ar: "أبها", en: "Abha" },
  { code: "khamis-mushait", ar: "خميس مشيط", en: "Khamis Mushait" },
  { code: "najran", ar: "نجران", en: "Najran" },
  { code: "jazan", ar: "جازان", en: "Jazan" },
  { code: "yanbu", ar: "ينبع", en: "Yanbu" },
  { code: "baha", ar: "الباحة", en: "Al-Baha" },
  { code: "arar", ar: "عرعر", en: "Arar" },
  { code: "sakaka", ar: "سكاكا", en: "Sakaka" },
  { code: "qurayyat", ar: "القريات", en: "Qurayyat" },
  { code: "other", ar: "مدينة أخرى", en: "Another city" },
] as const;

export const SAUDI_CITY_CODES = SAUDI_CITIES.map((c) => c.code);

export function findSaudiCity(code: string | null | undefined): SaudiCity | null {
  if (!code) return null;
  return SAUDI_CITIES.find((c) => c.code === code) ?? null;
}

/**
 * The city's own name, or null when we genuinely don't know.
 *
 * `other` returns null on purpose: the owner told us their city isn't listed,
 * which is not the same as telling us where they live. Anything downstream
 * that names a city must fall back to saying nothing rather than guessing.
 */
export function saudiCityLabel(
  code: string | null | undefined,
  locale: "ar" | "en"
): string | null {
  const city = findSaudiCity(code);
  if (!city || city.code === "other") return null;
  return locale === "ar" ? city.ar : city.en;
}
