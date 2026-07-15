/**
 * Plan catalogue — the 3 official Moracat boxes. Mirrors the DB (seed-catalog)
 * and the financial model so marketing renders correct pricing even before the
 * API responds. Single source of truth: seed-catalog.ts / GET /plans.
 *
 * Pricing is per MONTH; a member commits to a minimum term (3 months) and pays
 * price × term upfront via Tamara. 0% VAT (Moracat is not VAT-registered yet;
 * VAT is a one-flag toggle in the API — see common/config/pricing.ts).
 */
export type PlanTier = "starter" | "standard" | "premium";

export interface Plan {
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  price: number; // SAR / month
  taglineEn: string;
  taglineAr: string;
  featuresEn: string[];
  featuresAr: string[];
  popular?: boolean;
}

/** Minimum committed subscription term, in months (KSA policy). */
export const MIN_TERM_MONTHS = 3;
/** Term options offered at checkout. */
export const TERM_OPTIONS = [3, 6, 12] as const;

export const PLANS: Plan[] = [
  {
    tier: "starter",
    nameEn: "Starter",
    nameAr: "المبتدئة",
    price: 249,
    taglineEn: "Everyday food for one cat",
    taglineAr: "تغذية يومية لقط واحد",
    featuresEn: ["15 wet food pouches", "2kg dry food", "Creamy treats", "Light box, no litter"],
    featuresAr: ["١٥ كيس طعام رطب", "٢كجم طعام جاف", "مكافآت كريمية", "صندوق خفيف بدون رمل"],
  },
  {
    tier: "standard",
    nameEn: "Standard",
    nameAr: "القياسية",
    price: 349,
    taglineEn: "Food + litter, everything handled",
    taglineAr: "طعام ورمل — كل شيء يُدار",
    featuresEn: ["15 premium wet cans", "2kg dry food", "10L clumping litter", "Calming treats"],
    featuresAr: ["١٥ معلبة رطبة فاخرة", "٢كجم طعام جاف", "١٠ لتر رمل متكتل", "مكافآت مهدّئة"],
    popular: true,
  },
  {
    tier: "premium",
    nameEn: "Premium",
    nameAr: "المميّزة",
    price: 529,
    taglineEn: "Premium food, litter, grooming & treats",
    taglineAr: "طعام فاخر ورمل وعناية ومكافآت",
    featuresEn: ["24 premium wet pouches", "2kg dry food", "Premium 10L litter", "Grooming wipes + treats"],
    featuresAr: ["٢٤ كيس رطب فاخر", "٢كجم طعام جاف", "رمل فاخر ١٠ لتر", "مناديل عناية + مكافآت"],
  },
];
