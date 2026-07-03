/** Smart Feeding engine — shared types. Pure, framework-agnostic. */

export type ActivityLevel = "LOW" | "MODERATE" | "HIGH";
export type LifeStage = "KITTEN" | "ADULT" | "SENIOR";
export type BodyCondition = "UNDERWEIGHT" | "IDEAL" | "OVERWEIGHT";

export interface FeedingInput {
  /** Current weight in kg. If omitted, breedAvgWeightKg is used (lowers confidence). */
  weightKg?: number;
  /** Age in months — used to derive life stage when lifeStage is not given. */
  ageMonths?: number;
  lifeStage?: LifeStage;
  activity: ActivityLevel;
  isIndoor: boolean;
  /** Whether the cat is neutered/spayed — meaningfully lowers energy needs. */
  neutered?: boolean;
  bodyCondition?: BodyCondition;
  /** Fallback average weight for the breed (kg). */
  breedAvgWeightKg?: number;
  /**
   * Share of daily calories delivered as DRY food (0..1). Default 0.7.
   * The remainder comes from wet pouches.
   */
  dryShare?: number;
  /** Number of cats sharing the litter (affects litter quantity only). Default 1. */
  cats?: number;
  hasHealthConditions?: boolean;
}

export interface FeedingCostInputs {
  /** Retail price references (SAR) used for the cost estimate. */
  dryFoodPricePerKg: number;
  wetPouchPrice: number;
  litterPricePerKg: number;
  treatsPackPrice: number;
  supplementPrice: number;
}

export interface FeedingRecommendation {
  dailyCalories: number;
  dryFoodGramsPerDay: number;
  dryFoodKgPerMonth: number;
  wetPouchesPerDay: number;
  wetPouchesPerMonth: number;
  treatsPacksPerMonth: number;
  litterKgPerMonth: number;
  supplementsPerMonth: number;
  estimatedMonthlyCostSar: number;
  /** 0..1 — how much we trust this given the inputs supplied. */
  confidence: number;
  /** Human-readable, transparent explanation of how we got here. */
  rationale: {
    resolvedWeightKg: number;
    weightSource: "measured" | "breed-average" | "default";
    lifeStage: LifeStage;
    energyFactor: number;
    restingEnergyKcal: number;
    dryShare: number;
    notes: string[];
  };
}
