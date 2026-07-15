/**
 * D2 — the Plan Builder's brain: the plan is COMPUTED from the cat, never
 * chosen from a tier table (Design Authority amendment 2026-07-10).
 *
 * Runs the shared Smart Feeding engine (@moraqat/core — the same pure engine
 * behind /tools/feeding) once per active cat, sums the household's monthly
 * needs, and maps them onto the live plan catalogue. Missing profile fields
 * fall back exactly as the engine supports (default weight, adult life stage)
 * with honestly lowered confidence — we say so in the reasons rather than
 * pretending precision (R006).
 */

import {
  calculateFeeding,
  DAYS_PER_MONTH,
  DRY_FOOD_KCAL_PER_G,
  WET_POUCH_KCAL,
  type FeedingInput,
} from "@moraqat/core";
import { localizeName } from "./translit"; // relative so the unit tests resolve it too

/* ── Contracts ─────────────────────────────────────────────────────────────── */

export type PlanTier = "STARTER" | "STANDARD" | "PREMIUM";

/** GET /plans response shape (shared by subscribe + checkout). */
export interface ApiPlan {
  id: string;
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  price: number; // monthly price (SAR); customer pays price × termMonths upfront
  minTermMonths?: number;
  contents: { label: string; quantity: number; unit: string }[];
}

/** The cat fields the engine reads — PortalCat satisfies this structurally. */
export interface RecommendableCat {
  id: string;
  name: string;
  weightKg: number | null;
  birthDate: string | null;
  activityLevel: string;
  isIndoor: boolean;
  isNeutered?: boolean | null;
  lifeStage?: string | null;
  healthConditionNames?: string[];
}

export interface BilingualReason {
  ar: string;
  en: string;
}

export interface PlanRecommendation {
  tier: PlanTier;
  /** Transparent, engine-derived explanations — shown verbatim to the member. */
  reasons: BilingualReason[];
  /** 0..1 — the least-confident cat sets the household confidence (honest floor). */
  confidence: number;
  /** Summed monthly household needs, straight from the engine. */
  totals: {
    dryFoodKgPerMonth: number;
    wetPouchesPerMonth: number;
    litterKgPerMonth: number;
    treatsPacksPerMonth: number;
  };
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

const ACTIVITY = new Set(["LOW", "MODERATE", "HIGH"]);
const LIFE_STAGE = new Set(["KITTEN", "ADULT", "SENIOR"]);

function ageMonths(birthDate: string | null): number | undefined {
  if (!birthDate) return undefined;
  const b = new Date(birthDate);
  if (Number.isNaN(+b)) return undefined;
  const months = (Date.now() - b.getTime()) / (30.44 * 24 * 3600 * 1000);
  return months >= 0 ? Math.floor(months) : undefined;
}

/** Localized display numbers — Arabic reasons read in Arabic-Indic digits. */
const fmtAr = (n: number) => n.toLocaleString("ar-SA", { maximumFractionDigits: 1 });
const fmtEn = (n: number) => n.toLocaleString("en-GB", { maximumFractionDigits: 1 });

function toFeedingInput(cat: RecommendableCat): FeedingInput {
  return {
    weightKg: cat.weightKg && cat.weightKg > 0 ? cat.weightKg : undefined,
    ageMonths: ageMonths(cat.birthDate),
    lifeStage:
      cat.lifeStage && LIFE_STAGE.has(cat.lifeStage)
        ? (cat.lifeStage as FeedingInput["lifeStage"])
        : undefined,
    activity: ACTIVITY.has(cat.activityLevel)
      ? (cat.activityLevel as FeedingInput["activity"])
      : "MODERATE",
    isIndoor: cat.isIndoor ?? true,
    neutered: cat.isNeutered ?? undefined,
    hasHealthConditions: (cat.healthConditionNames?.length ?? 0) > 0,
    cats: 1, // litter is summed per cat below
  };
}

/**
 * How much food energy a plan's box actually delivers per month, using the
 * engine's own energy constants. Comparing calories (not item-by-item counts)
 * is the honest fit test: a box's dry/wet ratio can differ from the engine's
 * default split while still fully feeding the cat.
 */
function planMonthlyKcal(plan: ApiPlan): number {
  let kcal = 0;
  for (const c of plan.contents) {
    const label = c.label.toLowerCase();
    if (c.unit === "kg" && label.includes("dry")) kcal += c.quantity * 1000 * DRY_FOOD_KCAL_PER_G;
    if (c.unit === "pouch") kcal += c.quantity * WET_POUCH_KCAL;
  }
  return kcal;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/* ── The recommendation ────────────────────────────────────────────────────── */

/**
 * Compute the household's recommended plan. Returns null when there are no
 * active cats to compute from (the caller shows a welcome, not a tier table).
 */
export function recommendPlan(
  cats: RecommendableCat[],
  plans: ApiPlan[]
): PlanRecommendation | null {
  if (cats.length === 0) return null;

  const reasons: BilingualReason[] = [];
  let confidence = 1;
  let anySenior = false;
  let anyHealth = false;
  let dailyCaloriesTotal = 0;
  const totals = {
    dryFoodKgPerMonth: 0,
    wetPouchesPerMonth: 0,
    litterKgPerMonth: 0,
    treatsPacksPerMonth: 0,
  };

  for (const cat of cats) {
    const input = toFeedingInput(cat);
    const rec = calculateFeeding(input);

    totals.dryFoodKgPerMonth += rec.dryFoodKgPerMonth;
    totals.wetPouchesPerMonth += rec.wetPouchesPerMonth;
    totals.litterKgPerMonth += rec.litterKgPerMonth;
    totals.treatsPacksPerMonth += rec.treatsPacksPerMonth;
    dailyCaloriesTotal += rec.dailyCalories;
    confidence = Math.min(confidence, rec.confidence);

    if (rec.rationale.lifeStage === "SENIOR") anySenior = true;
    if (input.hasHealthConditions) anyHealth = true;

    const nameAr = localizeName(cat.name, "ar");
    const nameEn = localizeName(cat.name, "en");
    const w = rec.rationale.resolvedWeightKg;

    // Weight + age — the engine's primary levers, stated plainly.
    if (rec.rationale.weightSource === "measured") {
      const hasAge = input.ageMonths !== undefined || input.lifeStage !== undefined;
      reasons.push({
        ar: hasAge
          ? `محسوبة من وزن ${nameAr} (${fmtAr(w)} كجم) وعمره`
          : `محسوبة من وزن ${nameAr} (${fmtAr(w)} كجم)`,
        en: hasAge
          ? `Computed from ${nameEn}'s weight (${fmtEn(w)} kg) and age`
          : `Computed from ${nameEn}'s weight (${fmtEn(w)} kg)`,
      });
    } else {
      // Honest about the fallback — and a gentle nudge that helps the cat.
      reasons.push({
        ar: `وزن ${nameAr} غير مسجّل، فاعتمدنا وزناً معتاداً (${fmtAr(w)} كجم) — أضِف وزنه وتصير الخطة أدق`,
        en: `${nameEn}'s weight isn't recorded, so we used a typical ${fmtEn(w)} kg — add it and the plan gets sharper`,
      });
    }

    if (rec.rationale.lifeStage === "KITTEN") {
      reasons.push({
        ar: `${nameAr} في طور النمو — زدنا حصته من الطاقة`,
        en: `${nameEn} is still growing — we raised the energy allowance`,
      });
    } else if (rec.rationale.lifeStage === "SENIOR") {
      reasons.push({
        ar: `${nameAr} كبير بالعمر — سعرات أهدأ وعناية إضافية ضمن الباقة المميّزة`,
        en: `${nameEn} is a senior — gentler calories plus extra care under the Premium box`,
      });
    }

    if (input.hasHealthConditions) {
      reasons.push({
        ar: `ملف ${nameAr} الصحي يستدعي الباقة المميّزة`,
        en: `${nameEn}'s health record calls for the Premium box`,
      });
    }
  }

  totals.dryFoodKgPerMonth = round1(totals.dryFoodKgPerMonth);
  totals.wetPouchesPerMonth = Math.round(totals.wetPouchesPerMonth);
  totals.litterKgPerMonth = round1(totals.litterKgPerMonth);

  // Household monthly total — the number everything above adds up to.
  reasons.push({
    ar: `الاحتياج الشهري: ${fmtAr(totals.dryFoodKgPerMonth)} كجم طعام جاف، ${fmtAr(totals.wetPouchesPerMonth)} كيس رطب، ${fmtAr(totals.litterKgPerMonth)} كجم رمل`,
    en: `Monthly need: ${fmtEn(totals.dryFoodKgPerMonth)} kg dry food, ${fmtEn(totals.wetPouchesPerMonth)} wet pouches, ${fmtEn(totals.litterKgPerMonth)} kg litter`,
  });

  // ── Tier mapping (3 official boxes: Starter / Standard / Premium) ─────────
  // Sized to the cat, never upsold (R006). Multi-cat, senior, or health needs
  // map to Premium (the fullest box); otherwise Starter if its food energy
  // covers the monthly need, else Standard.
  let tier: PlanTier;
  if (cats.length >= 2) {
    tier = "PREMIUM";
    reasons.push({
      ar: `عندكم ${fmtAr(cats.length)} قطط — الباقة المميّزة تغطي احتياجهم بصندوق واحد`,
      en: `You have ${fmtEn(cats.length)} cats — the Premium box covers the household in one delivery`,
    });
  } else if (anySenior || anyHealth) {
    tier = "PREMIUM";
  } else {
    const monthlyKcalNeed = dailyCaloriesTotal * DAYS_PER_MONTH;
    const starter = plans.find((p) => p.tier === "STARTER");
    // Fallback mirrors the Starter box (2 kg dry + 15 pouches).
    const starterKcal = starter ? planMonthlyKcal(starter) : 2 * 1000 * DRY_FOOD_KCAL_PER_G + 15 * WET_POUCH_KCAL;
    const fitsStarter = starterKcal >= monthlyKcalNeed;
    tier = fitsStarter ? "STARTER" : "STANDARD";
    reasons.push(
      fitsStarter
        ? {
            ar: "كمية الباقة المبتدئة تغطي احتياجهم الشهري كاملاً — بلا زيادة ولا نقص",
            en: "The Starter box fully covers the monthly need — nothing more, nothing less",
          }
        : {
            ar: "احتياجهم الشهري أكبر من الباقة المبتدئة، فالقياسية هي المقاس الصحيح",
            en: "The monthly need outgrows the Starter box, so Standard is the right size",
          }
    );
  }

  return { tier, reasons, confidence, totals };
}
