/**
 * The membership price list — ONE declaration (Pricing Model v2, MRC-FIN-002).
 *
 * Before this file the same numbers lived in three places: the catalog seed
 * (what the database charges), apps/web/lib/plans.ts (what marketing shows)
 * and apps/api pricing.ts (the term maths). Three copies is how a page ends up
 * quoting a price checkout won't honour (R021). The seed, the API and the web
 * now all read from here; descriptive copy (features, taglines) stays with the
 * surface that renders it.
 *
 * Prices are what the member pays, VAT-inclusive whenever VAT applies — the
 * customer-facing number never moves when VAT registration flips (R006).
 */

export type PlanTierKey = "KITTEN" | "STARTER" | "STANDARD" | "PREMIUM";

export interface PlanPrice {
  tier: PlanTierKey;
  /** Lower-case slug used by the web and URLs. */
  slug: "kitten" | "starter" | "standard" | "premium";
  /** SAR per month, first cat included. */
  price: number;
  /** SAR per month for each additional cat in the household. */
  modulePrice: number;
  sortOrder: number;
}

export const PLAN_PRICES: readonly PlanPrice[] = [
  { tier: "KITTEN", slug: "kitten", price: 199, modulePrice: 180, sortOrder: 0 },
  { tier: "STARTER", slug: "starter", price: 219, modulePrice: 180, sortOrder: 1 },
  { tier: "STANDARD", slug: "standard", price: 329, modulePrice: 280, sortOrder: 2 },
  { tier: "PREMIUM", slug: "premium", price: 479, modulePrice: 400, sortOrder: 3 },
] as const;

export function planPrice(key: PlanTierKey | PlanPrice["slug"]): PlanPrice {
  const hit = PLAN_PRICES.find((p) => p.tier === key || p.slug === key);
  if (!hit) throw new Error(`Unknown plan: ${key}`);
  return hit;
}

/** Term options offered at checkout, in months (3 is the recommended default). */
export const TERM_OPTIONS = [1, 3, 6, 12] as const;
export type TermMonths = (typeof TERM_OPTIONS)[number];

/**
 * Prepaid-term discounts (MRC-FIN-002 §6). Deliberately shallow: at food-heavy
 * margins a −15/−25% ladder would make long terms lose money post-VAT, so
 * commitment is rewarded with gated gifts instead. Deterministic from the term
 * so every surface derives the same figure and nothing needs storing.
 */
export const TERM_DISCOUNTS: Record<TermMonths, number> = { 1: 0, 3: 0, 6: 0.05, 12: 0.08 };

export function termDiscount(termMonths: number): number {
  return TERM_DISCOUNTS[termMonths as TermMonths] ?? 0;
}

/** Maximum cats per household subscription (MRC-FIN-002 §5). */
export const MAX_CATS_PER_SUBSCRIPTION = 6;

/**
 * Household monthly price: base covers the first cat, each extra cat adds the
 * plan's module price. A plan without a module price is single-cat only.
 */
export function householdMonthlyPrice(basePrice: number, modulePrice: number | null, catCount: number): number {
  const extras = Math.max(0, catCount - 1);
  return Math.round((basePrice + (modulePrice ?? 0) * extras) * 100) / 100;
}

/** The exact upfront total for a term: monthly × months × (1 − discount), rounded. */
export function termTotal(monthlyPrice: number, termMonths: number): number {
  return Math.round(monthlyPrice * termMonths * (1 - termDiscount(termMonths)) * 100) / 100;
}

/**
 * How many of a plan line ship in ONE monthly box for a household.
 *
 * The commercial rule for multi-cat (MRC-FIN-002 §5): the member pays the base
 * price for the first cat and a module price per additional cat, so every
 * per-cat line (food, litter) ships once PER CAT; shared lines (wipes, a
 * supplement course, a toy) ship once per household. Before this rule existed
 * a three-cat household paid for three cats and received one cat's box.
 */
export function boxLineQuantity(line: { quantity: number; perCat: boolean }, catCount: number): number {
  const perBox = Math.max(1, Math.round(line.quantity));
  return line.perCat ? perBox * Math.max(1, catCount) : perBox;
}
