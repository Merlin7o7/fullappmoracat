/**
 * Plan catalogue — the 4 official Moracat plans (Pricing Model v2, MRC-FIN-002).
 * Mirrors the DB (seed-catalog) and the financial model so marketing renders
 * correct pricing even before the API responds. Single source of truth:
 * seed-catalog.ts / GET /plans.
 *
 * Value-first, additive ladder: Essentials carries ONLY necessities (wet + dry
 * + litter); every higher tier contains everything below it and adds value.
 * Pricing is per MONTH per household — the base price covers the first cat and
 * each additional cat adds `modulePrice` (up to MAX_CATS, curve per §5).
 * Savings claims are made against the MARKET basket (five-store sweep), never
 * against our own shelf (R006) — Essentials/Kitten make no savings claim at all.
 */
export type PlanTier = "kitten" | "starter" | "standard" | "premium";

export interface Plan {
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  price: number; // SAR / month, first cat included
  /** SAR / month for each additional cat (household module, MRC-FIN-002 §5). */
  modulePrice: number;
  taglineEn: string;
  taglineAr: string;
  featuresEn: string[];
  featuresAr: string[];
  popular?: boolean;
  /** Acquisition tier for cats under ~9 months (auto-graduates to adult plans). */
  kitten?: boolean;
}

/** Minimum committed subscription term, in months (1 = low-commitment entry). */
export const MIN_TERM_MONTHS = 1;
/** Term options offered at checkout (3 is the recommended default). */
export const TERM_OPTIONS = [1, 3, 6, 12] as const;
/**
 * Prepaid-term discounts — MUST mirror apps/api common/config/pricing.ts
 * (deterministic from the term so checkout previews exactly what the API
 * charges, R021). Longer terms also unlock gated gifts, not deeper cuts.
 */
export const TERM_DISCOUNTS: Record<number, number> = { 1: 0, 3: 0, 6: 0.05, 12: 0.08 };
/** Maximum cats per household subscription. */
export const MAX_CATS = 6;

/** Household monthly price: base + module × (extra cats). Mirrors the API. */
export function householdMonthly(plan: Plan, catCount: number): number {
  return Math.round((plan.price + plan.modulePrice * Math.max(0, catCount - 1)) * 100) / 100;
}

/** Upfront total for a term: monthly × months × (1 − discount). Mirrors the API. */
export function termTotal(monthly: number, termMonths: number): number {
  return Math.round(monthly * termMonths * (1 - (TERM_DISCOUNTS[termMonths] ?? 0)) * 100) / 100;
}

export const PLANS: Plan[] = [
  {
    tier: "kitten",
    nameEn: "Kitten",
    nameAr: "قطتي الصغيرة",
    price: 199,
    modulePrice: 180,
    kitten: true,
    taglineEn: "Stage-aware care for 3–8 months",
    taglineAr: "عناية مرحلية لعمر ٣–٨ أشهر",
    featuresEn: [
      "2kg kitten dry food",
      "15 kitten wet pouches & cans",
      "10L gentle clumping litter",
      "Grows with her — graduates to an adult plan at ~9 months",
    ],
    featuresAr: [
      "٢كجم طعام جاف للصغار",
      "١٥ كيساً وعلبة طعام رطب للصغار",
      "١٠ لتر رمل متكتل لطيف",
      "تكبر معها — تنتقل لخطة البالغين عند ~٩ أشهر",
    ],
  },
  {
    tier: "starter",
    nameEn: "Essentials",
    nameAr: "الأساسيات",
    price: 219,
    modulePrice: 180,
    taglineEn: "Only the necessities — delivered, never out of stock",
    taglineAr: "الضروريات فقط — تصلك بابك ولا تنفد أبداً",
    featuresEn: [
      "2kg dry food",
      "15 wet food pouches",
      "10L clumping litter",
      "No extras — necessities at market price",
    ],
    featuresAr: [
      "٢كجم طعام جاف",
      "١٥ كيس طعام رطب",
      "١٠ لتر رمل متكتل",
      "بدون إضافات — الضروريات بسعر السوق",
    ],
  },
  {
    tier: "standard",
    nameEn: "Complete",
    nameAr: "العناية الكاملة",
    price: 329,
    modulePrice: 280,
    taglineEn: "A true month of food — plus care and play",
    taglineAr: "شهر كامل فعلاً من الطعام — مع العناية واللعب",
    featuresEn: [
      "30 wet pouches — a real month of mixed feeding",
      "2kg dry food + 10L litter",
      "Treats, toy & grooming wipes",
      "Genuinely below the same basket at market prices",
    ],
    featuresAr: [
      "٣٠ كيساً رطباً — شهر حقيقي من التغذية المختلطة",
      "٢كجم طعام جاف + ١٠ لتر رمل",
      "مكافآت ولعبة ومناديل عناية",
      "أقل فعلياً من نفس السلة بأسعار السوق",
    ],
    popular: true,
  },
  {
    tier: "premium",
    nameEn: "Signature",
    nameAr: "التوقيع",
    price: 479,
    modulePrice: 400,
    taglineEn: "Complete, upgraded — the full care ritual",
    taglineAr: "العناية الكاملة، مرفوعة درجة — طقس العناية الكامل",
    featuresEn: [
      "Everything in Complete",
      "+9 premium wet rotation pouches",
      "Advanced clumping litter upgrade",
      "Monthly supplement course & premium toy",
    ],
    featuresAr: [
      "كل ما في العناية الكاملة",
      "+٩ أكياس تشكيلة رطب فاخرة",
      "ترقية إلى رمل متكتل متقدم",
      "كورس مكملات شهري ولعبة فاخرة",
    ],
  },
];
