import {
  DAYS_PER_MONTH,
  DEFAULT_DRY_SHARE,
  DRY_FOOD_KCAL_PER_G,
  ENERGY_FACTORS,
  LITTER_KG_PER_CAT_MONTH_INDOOR,
  LITTER_KG_PER_CAT_MONTH_OUTDOOR,
  WET_POUCH_KCAL,
} from "./constants";
import type {
  FeedingCostInputs,
  FeedingInput,
  FeedingRecommendation,
  LifeStage,
} from "./types";

/** Default retail references (SAR) — mirror the seeded catalogue. */
export const DEFAULT_COSTS: FeedingCostInputs = {
  dryFoodPricePerKg: 27,
  wetPouchPrice: 3,
  litterPricePerKg: 4.5,
  treatsPackPrice: 18,
  supplementPrice: 29,
};

const round = (n: number, dp = 1): number => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};
const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** Derive life stage from age when not explicitly provided. */
function resolveLifeStage(input: FeedingInput): LifeStage {
  if (input.lifeStage) return input.lifeStage;
  const age = input.ageMonths;
  if (age === undefined) return "ADULT";
  if (age < 12) return "KITTEN";
  if (age >= 120) return "SENIOR"; // ~10 years+
  return "ADULT";
}

/** Compose the Maintenance Energy factor from life stage + modifiers. */
function resolveEnergyFactor(
  input: FeedingInput,
  lifeStage: LifeStage,
  notes: string[]
): number {
  let factor: number;
  if (lifeStage === "KITTEN") {
    factor =
      input.ageMonths !== undefined && input.ageMonths < 4
        ? ENERGY_FACTORS.kittenYoung
        : ENERGY_FACTORS.kitten;
    notes.push("Growing kitten — elevated energy needs.");
  } else if (lifeStage === "SENIOR") {
    factor = ENERGY_FACTORS.senior;
    notes.push("Senior cat — reduced baseline energy.");
  } else {
    factor = input.neutered ? ENERGY_FACTORS.adultNeutered : ENERGY_FACTORS.adultIntact;
    notes.push(input.neutered ? "Neutered adult." : "Intact adult.");
  }

  // Kittens are always fed to grow — skip the reducing modifiers for them.
  if (lifeStage !== "KITTEN") {
    if (input.isIndoor && input.activity === "LOW") {
      factor *= ENERGY_FACTORS.indoorInactive;
      notes.push("Indoor + low activity — slightly less food.");
    }
    if (input.activity === "HIGH") {
      factor *= ENERGY_FACTORS.highActivity;
      notes.push("High activity — more food.");
    }
    if (input.bodyCondition === "OVERWEIGHT") {
      factor *= ENERGY_FACTORS.overweight;
      notes.push("Overweight — calorie-restricted for healthy weight loss.");
    } else if (input.bodyCondition === "UNDERWEIGHT") {
      factor *= ENERGY_FACTORS.underweight;
      notes.push("Underweight — increased calories.");
    }
  }
  return factor;
}

/**
 * Compute a monthly feeding recommendation from a cat's profile.
 * Deterministic and pure — same inputs always yield the same output.
 */
export function calculateFeeding(
  input: FeedingInput,
  costs: FeedingCostInputs = DEFAULT_COSTS
): FeedingRecommendation {
  const notes: string[] = [];

  // ── 1. Resolve weight ──────────────────────────────────────────────────
  let resolvedWeightKg: number;
  let weightSource: FeedingRecommendation["rationale"]["weightSource"];
  if (input.weightKg && input.weightKg > 0) {
    resolvedWeightKg = input.weightKg;
    weightSource = "measured";
  } else if (input.breedAvgWeightKg && input.breedAvgWeightKg > 0) {
    resolvedWeightKg = input.breedAvgWeightKg;
    weightSource = "breed-average";
    notes.push("Weight not provided — using breed average.");
  } else {
    resolvedWeightKg = 4.0; // typical adult domestic cat
    weightSource = "default";
    notes.push("No weight or breed — using a 4.0 kg default.");
  }
  resolvedWeightKg = clamp(resolvedWeightKg, 0.3, 15);

  // ── 2. Energy: RER then MER ────────────────────────────────────────────
  const lifeStage = resolveLifeStage(input);
  const restingEnergyKcal = 70 * Math.pow(resolvedWeightKg, 0.75);
  const energyFactor = resolveEnergyFactor(input, lifeStage, notes);
  const dailyCalories = restingEnergyKcal * energyFactor;

  // ── 3. Split calories into dry + wet ───────────────────────────────────
  const dryShare = clamp(input.dryShare ?? DEFAULT_DRY_SHARE, 0, 1);
  const dryCalories = dailyCalories * dryShare;
  const wetCalories = dailyCalories * (1 - dryShare);

  const dryFoodGramsPerDay = dryCalories / DRY_FOOD_KCAL_PER_G;
  const dryFoodKgPerMonth = (dryFoodGramsPerDay * DAYS_PER_MONTH) / 1000;
  const wetPouchesPerDay = wetCalories / WET_POUCH_KCAL;
  const wetPouchesPerMonth = wetPouchesPerDay * DAYS_PER_MONTH;

  // ── 4. Litter, treats, supplements ─────────────────────────────────────
  const cats = Math.max(1, input.cats ?? 1);
  const litterPerCat = input.isIndoor
    ? LITTER_KG_PER_CAT_MONTH_INDOOR
    : LITTER_KG_PER_CAT_MONTH_OUTDOOR;
  const litterKgPerMonth = litterPerCat * cats;

  const treatsPacksPerMonth = lifeStage === "KITTEN" ? 1 : 2;
  const supplementsPerMonth =
    input.hasHealthConditions || lifeStage === "SENIOR" ? 1 : 0;
  if (supplementsPerMonth > 0) {
    notes.push(
      input.hasHealthConditions
        ? "Health conditions — a monthly supplement is recommended."
        : "Senior — a monthly joint/wellness supplement is recommended."
    );
  }

  // ── 5. Cost estimate (SAR) ─────────────────────────────────────────────
  const estimatedMonthlyCostSar =
    dryFoodKgPerMonth * costs.dryFoodPricePerKg +
    wetPouchesPerMonth * costs.wetPouchPrice +
    litterKgPerMonth * costs.litterPricePerKg +
    treatsPacksPerMonth * costs.treatsPackPrice +
    supplementsPerMonth * costs.supplementPrice;

  // ── 6. Confidence ──────────────────────────────────────────────────────
  let confidence = 0.5;
  if (weightSource === "measured") confidence += 0.3;
  else if (weightSource === "breed-average") confidence += 0.1;
  if (input.ageMonths !== undefined || input.lifeStage) confidence += 0.1;
  if (input.bodyCondition) confidence += 0.05;
  if (input.neutered !== undefined) confidence += 0.05;
  confidence = clamp(round(confidence, 2), 0, 1);

  return {
    dailyCalories: round(dailyCalories, 0),
    dryFoodGramsPerDay: round(dryFoodGramsPerDay, 0),
    dryFoodKgPerMonth: round(dryFoodKgPerMonth, 2),
    wetPouchesPerDay: round(wetPouchesPerDay, 1),
    wetPouchesPerMonth: Math.round(wetPouchesPerMonth),
    treatsPacksPerMonth,
    litterKgPerMonth: round(litterKgPerMonth, 1),
    supplementsPerMonth,
    estimatedMonthlyCostSar: round(estimatedMonthlyCostSar, 2),
    confidence,
    rationale: {
      resolvedWeightKg: round(resolvedWeightKg, 2),
      weightSource,
      lifeStage,
      energyFactor: round(energyFactor, 3),
      restingEnergyKcal: round(restingEnergyKcal, 0),
      dryShare,
      notes,
    },
  };
}
