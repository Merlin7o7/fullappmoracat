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

/** Tier enums → display names (MRC-FIN-002): KITTEN "Kitten/قطتي الصغيرة" ·
 *  STARTER "Essentials/الأساسيات" · STANDARD "Complete/العناية الكاملة" ·
 *  PREMIUM "Signature/التوقيع". */
export type PlanTier = "KITTEN" | "STARTER" | "STANDARD" | "PREMIUM";

/** GET /plans response shape (shared by subscribe + checkout). */
export interface ApiPlan {
  id: string;
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  price: number; // monthly price (SAR), first cat included
  /** SAR / month for each ADDITIONAL cat in the household (MRC-FIN-002 §5);
   *  null = single-cat plan. */
  modulePriceSar?: number | null;
  maxCats?: number;
  /** The MARKET benchmark basket (five-store sweep) — the only honest basis
   *  for a savings claim (R006). */
  marketValue?: number | null;
  /** null when there is NO genuine saving (Essentials/Kitten) — those tiers
   *  are framed "market price, delivered", never with a وفر/savings claim. */
  marketSavings?: number | null;
  marketSavingsPct?: number | null;
  minTermMonths?: number;
  contents: {
    label: string;
    labelAr?: string | null;
    quantity: number;
    unit: string;
    unitAr?: string | null;
    /** Ships once per cat (household modules) vs once per household. */
    perCat?: boolean;
  }[];
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
  /** A short "why this one" category, shown as the recommendation headline
   *  (best value / best nutrition / multi-cat / premium / senior care). */
  headline: BilingualReason;
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
  let maxDailyCalories = 0; // the hungriest cat sets the shared household tier
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
    maxDailyCalories = Math.max(maxDailyCalories, rec.dailyCalories);
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
        ar: `${nameAr} كبير بالعمر — سعرات أهدأ وعناية إضافية ضمن باقة التوقيع`,
        en: `${nameEn} is a senior — gentler calories plus extra care under the Signature box`,
      });
    }

    if (input.hasHealthConditions) {
      reasons.push({
        ar: `ملف ${nameAr} الصحي يستدعي باقة التوقيع`,
        en: `${nameEn}'s health record calls for the Signature box`,
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

  // ── Tier mapping (4 official boxes: Kitten / Essentials / Complete / Signature)
  // Sized to the cat, never upsold (R006). The kitten rule comes FIRST
  // (MRC-FIN-002 §4 — stage-aware, not a shrunken adult box). Senior or health
  // needs map to Signature; otherwise Essentials if its food energy covers the
  // hungriest cat's month, else Complete. A multi-cat household keeps the SAME
  // tier — one subscription, each cat with their own module (§5) — never a
  // forced upgrade to the top box.
  const kittenAges = cats.map((c) => ageMonths(c.birthDate));
  const kittenCount = kittenAges.filter((m) => m !== undefined && m < 9).length;
  const allKittens = kittenCount === cats.length && cats.length > 0;

  let tier: PlanTier;
  if (allKittens) {
    tier = "KITTEN";
    reasons.push({
      ar:
        cats.length === 1
          ? "عمره أقل من ٩ أشهر — باقة قطتي الصغيرة مصممة لمرحلته، وتنتقل لخطة البالغين لما يكبر"
          : "كلهم أصغر من ٩ أشهر — باقة قطتي الصغيرة مصممة لمرحلتهم، وتنتقل لخطة البالغين لما يكبرون",
      en:
        cats.length === 1
          ? "Under 9 months old — the Kitten box is built for this stage, and graduates to an adult plan as they grow"
          : "All under 9 months old — the Kitten box is built for this stage, and graduates to an adult plan as they grow",
    });
  } else if (anySenior || anyHealth) {
    tier = "PREMIUM";
  } else {
    const monthlyKcalNeed = maxDailyCalories * DAYS_PER_MONTH;
    const essentials = plans.find((p) => p.tier === "STARTER");
    // Fallback mirrors the Essentials box (2 kg dry + 15 pouches).
    const essentialsKcal = essentials
      ? planMonthlyKcal(essentials)
      : 2 * 1000 * DRY_FOOD_KCAL_PER_G + 15 * WET_POUCH_KCAL;
    const fitsEssentials = essentialsKcal >= monthlyKcalNeed;
    tier = fitsEssentials ? "STARTER" : "STANDARD";
    reasons.push(
      fitsEssentials
        ? {
            ar: "كمية باقة الأساسيات تغطي احتياجهم الشهري كاملاً — بلا زيادة ولا نقص",
            en: "The Essentials box fully covers the monthly need — nothing more, nothing less",
          }
        : {
            ar: "احتياجهم الشهري أكبر من باقة الأساسيات، فالعناية الكاملة هي المقاس الصحيح",
            en: "The monthly need outgrows the Essentials box, so Complete is the right size",
          }
    );
  }

  // Household modules (MRC-FIN-002 §5): the tier stays the same; each extra cat
  // adds their own module inside one shared box — said plainly, no upsell.
  if (cats.length >= 2) {
    reasons.push({
      ar: `عندكم ${fmtAr(cats.length)} قطط — اشتراك عائلي واحد يغطيهم كلهم: صندوق مشترك ولكل قط حصته الخاصة`,
      en: `You have ${fmtEn(cats.length)} cats — one household subscription covers them all: a shared box with each cat's own share`,
    });
    if (kittenCount > 0 && !allKittens) {
      reasons.push({
        ar: "وفيهم قط صغير — حصته تجي بمنتجات الصغار المناسبة لعمره",
        en: "One of them is a kitten — their share arrives as stage-right kitten products",
      });
    }
  }

  // ── The headline: a personal "why this one" category (conversion + clarity) ──
  let headline: BilingualReason;
  if (allKittens) {
    headline = { ar: "عناية مرحلية لقطك الصغير", en: "Stage-aware kitten care" };
  } else if (anyHealth) {
    headline = { ar: "الأفضل للعناية الصحية", en: "Best for health & care" };
  } else if (anySenior) {
    headline = { ar: "عناية ألطف لقط كبير", en: "Gentle care for a senior cat" };
  } else if (cats.length >= 2) {
    headline = { ar: "الأنسب لبيت متعدد القطط", en: "Best for a multi-cat home" };
  } else if (tier === "PREMIUM") {
    headline = { ar: "التوقيع — طقس العناية الكامل", en: "Signature — the full care ritual" };
  } else if (tier === "STANDARD") {
    headline = { ar: "شهر كامل فعلاً من العناية", en: "A true month of care" };
  } else {
    headline = { ar: "الضروريات — على مقاسه تماماً", en: "The necessities — sized exactly to them" };
  }

  return { tier, headline, reasons, confidence, totals };
}
