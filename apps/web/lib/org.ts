/**
 * Single source of truth for the legal entity and contact identity.
 *
 * The BRAND (Moracat / مرقط) is what members see and love; the LEGAL ENTITY is
 * the registered establishment that operates it. Keep them distinct: marketing
 * uses the brand, while copyright, legal documents, official emails, and
 * structured data must name the legal entity (a Saudi consumer-trust and PDPL
 * expectation). Everything here is imported — never hard-code these values again.
 */

export const BRAND = {
  ar: "مرقط",
  en: "Moracat",
} as const;

export const LEGAL_ENTITY = {
  ar: "مؤسسة عبدالرحمن منصور الغامدي التجارية",
  en: "Abdulrahman Mansour Alghamdi Trading Establishment",
} as const;

/**
 * Official registration numbers — what a Saudi consumer looks for before
 * trusting a site with their data. Read from the environment and shown ONLY
 * when set: a registration number is never guessed, defaulted or hard-coded
 * (R006 honest by default). Set NEXT_PUBLIC_CR_NUMBER / NEXT_PUBLIC_VAT_NUMBER
 * in the web environment to publish them in the footer.
 */
const cleanReg = (v: string | undefined) => (v && /^[0-9]{6,15}$/.test(v.trim()) ? v.trim() : null);
export const REGISTRATION = {
  crNumber: cleanReg(process.env.NEXT_PUBLIC_CR_NUMBER),
  vatNumber: cleanReg(process.env.NEXT_PUBLIC_VAT_NUMBER),
} as const;

const PHONE_E164 = "+966551094814";

export const CONTACT = {
  instagramHandle: "@moracat.sa",
  instagramUrl: "https://instagram.com/moracat.sa",
  /** E.164 form for the tel: link (no spaces). */
  phone: PHONE_E164,
  /** Grouped for human reading. */
  phoneDisplay: "+966 55 109 4814",
  /** Clickable on mobile. */
  telHref: `tel:${PHONE_E164}`,
  privacyEmail: "privacy@moracat.co",
  reportEmail: "report@moracat.co",
  supportEmail: "support@moracat.co",
} as const;

/** Bilingual copyright line naming the operating entity. */
export function copyright(locale: "ar" | "en", year = 2026): string {
  return locale === "ar"
    ? `© ${year} ${LEGAL_ENTITY.ar}. جميع الحقوق محفوظة.`
    : `© ${year} ${LEGAL_ENTITY.en}. All rights reserved.`;
}
