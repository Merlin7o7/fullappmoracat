/**
 * Plan catalogue — the 4 Moracat care plans (Pricing Model v2, MRC-FIN-002).
 * Mirrors the DB (seed-catalog) and the financial model so marketing renders
 * correct pricing even before the API responds. Single source of truth:
 * seed-catalog.ts / GET /plans.
 *
 * Value-first, additive ladder: Essentials carries ONLY necessities (wet + dry
 * + litter); every higher tier contains everything below it and adds value.
 * Pricing is per MONTH per household — the base price covers the first cat and
 * each additional cat adds `modulePrice` (up to MAX_CATS, curve per §5).
 * No plan makes a comparative price claim (R006): the July 2026 market sweep
 * did not support one, so the copy describes what is in the box — never that
 * it costs less than buying the same things elsewhere. Lexicon (R087): the paid
 * product is «خطة العناية», never «باقة» / «اشتراك» in member-facing copy.
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
  /** Acquisition tier for cats under ~9 months (auto-graduates to adult plans). */
  kitten?: boolean;
}

import {
  TERM_OPTIONS as CORE_TERM_OPTIONS,
  TERM_DISCOUNTS as CORE_TERM_DISCOUNTS,
  MAX_CATS_PER_SUBSCRIPTION,
  householdMonthlyPrice,
  termTotal as coreTermTotal,
  planPrice,
} from "@moraqat/core";

/** Minimum committed subscription term, in months (1 = low-commitment entry). */
export const MIN_TERM_MONTHS = 1;
/** Term options offered at checkout (3 is the recommended default) — from @moraqat/core. */
export const TERM_OPTIONS = CORE_TERM_OPTIONS;
/** Prepaid-term discounts — the same object the API charges with (R021). */
export const TERM_DISCOUNTS: Record<number, number> = CORE_TERM_DISCOUNTS;
/** Maximum cats per household subscription. */
export const MAX_CATS = MAX_CATS_PER_SUBSCRIPTION;

/** Household monthly price: base + module × (extra cats). Same function as the API. */
export function householdMonthly(plan: Plan, catCount: number): number {
  return householdMonthlyPrice(plan.price, plan.modulePrice, catCount);
}

/** Upfront total for a term: monthly × months × (1 − discount). Same function as the API. */
export function termTotal(monthly: number, termMonths: number): number {
  return coreTermTotal(monthly, termMonths);
}

export const PLANS: Plan[] = [
  {
    tier: "kitten",
    nameEn: "Kitten",
    nameAr: "قطتي الصغيرة",
    price: planPrice("kitten").price,
    modulePrice: planPrice("kitten").modulePrice,
    kitten: true,
    taglineEn: "Stage-aware care for 3–8 months",
    taglineAr: "عناية مرحلية لعمر 3–8 أشهر",
    featuresEn: [
      "2kg kitten dry food",
      "15 kitten wet pouches & cans",
      "10L gentle clumping litter",
      "Grows with your cat — moves to an adult plan at ~9 months",
    ],
    featuresAr: [
      "2كجم طعام جاف للصغار",
      "15 كيساً وعلبة طعام رطب للصغار",
      "10 لتر رمل متكتل لطيف",
      "تكبر مع قطك — تنتقل لخطة البالغين عند ~9 أشهر",
    ],
  },
  {
    tier: "starter",
    nameEn: "Essentials",
    nameAr: "الأساسيات",
    price: planPrice("starter").price,
    modulePrice: planPrice("starter").modulePrice,
    taglineEn: "Only the necessities — delivered, never out of stock",
    taglineAr: "الضروريات فقط — تصلك بابك ولا تنفد أبداً",
    featuresEn: [
      "2kg dry food",
      "15 wet food pouches",
      "10L clumping litter",
      "No extras — just the necessities",
    ],
    featuresAr: [
      "2كجم طعام جاف",
      "15 كيس طعام رطب",
      "10 لتر رمل متكتل",
      "بدون إضافات — الضروريات فقط",
    ],
  },
  {
    tier: "standard",
    nameEn: "Complete",
    nameAr: "العناية الكاملة",
    price: planPrice("standard").price,
    modulePrice: planPrice("standard").modulePrice,
    taglineEn: "A true month of food — plus care and play",
    taglineAr: "شهر كامل فعلاً من الطعام — مع العناية واللعب",
    featuresEn: [
      "30 wet pouches — a real month of mixed feeding",
      "2kg dry food + 10L litter",
      "Treats, toy & grooming wipes",
    ],
    featuresAr: [
      "30 كيساً رطباً — شهر حقيقي من التغذية المختلطة",
      "2كجم طعام جاف + 10 لتر رمل",
      "مكافآت ولعبة ومناديل عناية",
    ],
  },
  {
    tier: "premium",
    nameEn: "Signature",
    nameAr: "التوقيع",
    price: planPrice("premium").price,
    modulePrice: planPrice("premium").modulePrice,
    taglineEn: "Complete, a step further",
    taglineAr: "العناية الكاملة، بدرجة أعلى",
    featuresEn: [
      "Everything in Complete",
      "+9 premium wet rotation pouches",
      "Advanced clumping litter upgrade",
      "Monthly supplements & a premium toy",
    ],
    featuresAr: [
      "كل ما في العناية الكاملة",
      "+9 أكياس تشكيلة رطب فاخرة",
      "ترقية إلى رمل متكتل متقدم",
      "مكمّلات شهرية ولعبة فاخرة",
    ],
  },
];
