/**
 * Veterinary reference constants for the Smart Feeding engine.
 * Sources: WSAVA Global Nutrition Guidelines; standard RER/MER methodology
 * (RER = 70 × BW_kg^0.75). Energy factors are the widely-used clinical ranges.
 */

/** Average energy density of dry cat food (kcal per gram). */
export const DRY_FOOD_KCAL_PER_G = 3.6;

/** Energy per standard 85 g wet pouch (kcal). */
export const WET_POUCH_KCAL = 76;

/** Days used to convert daily → monthly quantities. */
export const DAYS_PER_MONTH = 30.4;

/** Baseline litter consumption per indoor cat (kg / month). */
export const LITTER_KG_PER_CAT_MONTH_INDOOR = 7;
/** Outdoor cats use the box less. */
export const LITTER_KG_PER_CAT_MONTH_OUTDOOR = 4;

/** Default share of calories delivered as dry food. */
export const DEFAULT_DRY_SHARE = 0.7;

/**
 * Maintenance Energy Requirement multipliers applied to RER.
 * The engine composes life-stage × activity/neuter/indoor into one factor.
 */
export const ENERGY_FACTORS = {
  kitten: 2.5, // 4–12 months
  kittenYoung: 3.0, // < 4 months
  adultNeutered: 1.2,
  adultIntact: 1.4,
  senior: 1.1,
  // Adjustments (multiplicative)
  indoorInactive: 0.9,
  highActivity: 1.15,
  overweight: 0.8,
  underweight: 1.2,
} as const;
