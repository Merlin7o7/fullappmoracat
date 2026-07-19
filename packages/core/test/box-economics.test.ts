import { describe, expect, it } from "vitest";
import {
  computeBoxEconomics,
  checkBoxInvariants,
  minimumViablePrice,
  DEFAULT_COST_MODEL,
  DEFAULT_INVARIANTS,
  type RecipeLine,
} from "../src/pricing/box-economics";

/** Real supplier costs from data/supplier-catalog-2026-07.psv. */
const COST = {
  pouch: 3.5,
  dry2kg: 46,
  treats: 6.25,
} as const;

const recipeAt = (markup: number): RecipeLine[] => [
  { sku: "pouch", quantity: 15, unitCost: COST.pouch, unitRetail: Math.round(COST.pouch * markup) },
  { sku: "dry", quantity: 1, unitCost: COST.dry2kg, unitRetail: Math.round(COST.dry2kg * markup) },
  { sku: "treats", quantity: 1, unitCost: COST.treats, unitRetail: Math.round(COST.treats * markup) },
];

describe("computeBoxEconomics", () => {
  it("computes goods cost from the recipe, not from a hard-coded constant", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(1.8), boxPrice: 249 });
    // 15×3.5 + 46 + 6.25
    expect(e.goodsCost).toBe(104.75);
  });

  it("counts every operational cost, not just goods", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(1.8), boxPrice: 249 });
    const expected =
      e.goodsCost +
      e.shrink +
      DEFAULT_COST_MODEL.packagingSar +
      DEFAULT_COST_MODEL.deliverySar +
      DEFAULT_COST_MODEL.fulfilmentSar +
      e.paymentFee;
    expect(e.totalCost).toBeCloseTo(expected, 2);
    // The seed's old "margin" print was (price - cogs)/price, which ignored all
    // of the above and overstated margin by ~20 points.
    expect(e.contributionPct).toBeLessThan((249 - e.goodsCost) / 249);
  });

  it("treats VAT as inclusive — registering removes margin, it does not raise price", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(1.8), boxPrice: 249 });
    expect(e.vatRegistered.netRevenue + e.vatRegistered.vatDue).toBeCloseTo(249, 2);
    expect(e.vatRegistered.contribution).toBeCloseTo(e.contribution - e.vatRegistered.vatDue, 2);
    expect(e.vatRegistered.contributionPct).toBeLessThan(e.contributionPct);
  });
});

describe("invariant 1 — the box must beat à-la-carte", () => {
  it("flags the shipped configuration, where the box cost MORE than its contents", () => {
    // markup 1.8× → Starter retail 184 against a 249 box.
    const e = computeBoxEconomics({ recipe: recipeAt(1.8), boxPrice: 249 });
    expect(e.memberSavings).toBeLessThan(0);
    const violations = checkBoxInvariants(e);
    const value = violations.find((v) => v.invariant === "MEMBER_VALUE");
    expect(value).toBeDefined();
    expect(value!.message).toMatch(/MORE than buying its contents/i);
  });

  it("still flags a positive but insufficient saving", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(2.5), boxPrice: 249 });
    expect(e.memberSavings).toBeGreaterThan(0);
    expect(checkBoxInvariants(e).some((v) => v.invariant === "MEMBER_VALUE")).toBe(true);
  });

  it("passes once the box genuinely undercuts the shelf", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(3.0), boxPrice: 249 });
    expect(e.savingsPct).toBeGreaterThanOrEqual(DEFAULT_INVARIANTS.minMemberSaving);
    expect(checkBoxInvariants(e).some((v) => v.invariant === "MEMBER_VALUE")).toBe(false);
  });
});

describe("invariant 2 — margin must survive VAT registration", () => {
  it("rejects a plan that only clears the floor while unregistered", () => {
    const e = computeBoxEconomics({ recipe: recipeAt(3.0), boxPrice: 249 });
    // Healthy today…
    expect(e.contributionPct).toBeGreaterThanOrEqual(DEFAULT_INVARIANTS.minContribution);
    // …but this is exactly the trap: registration is mandatory above SAR 375k.
    const violations = checkBoxInvariants(e);
    const postVat = violations.find((v) => v.invariant === "CONTRIBUTION_POST_VAT");
    expect(postVat).toBeDefined();
    expect(postVat!.message).toMatch(/375k|registration/i);
  });

  it("accepts a plan priced above its minimum viable price", () => {
    const recipe = recipeAt(3.4);
    const floor = minimumViablePrice(recipe);
    const e = computeBoxEconomics({ recipe, boxPrice: floor });
    expect(checkBoxInvariants(e).some((v) => v.invariant.startsWith("CONTRIBUTION"))).toBe(false);
  });
});

describe("minimumViablePrice", () => {
  it("is the lowest price clearing the floor post-VAT", () => {
    const recipe = recipeAt(1.8);
    const floor = minimumViablePrice(recipe);
    const at = computeBoxEconomics({ recipe, boxPrice: floor });
    const below = computeBoxEconomics({ recipe, boxPrice: floor - 10 });
    expect(at.vatRegistered.contributionPct).toBeGreaterThanOrEqual(
      DEFAULT_INVARIANTS.minContribution
    );
    expect(below.vatRegistered.contributionPct).toBeLessThan(DEFAULT_INVARIANTS.minContribution);
  });

  it("responds to the cost model rather than assuming fixed logistics", () => {
    const recipe = recipeAt(1.8);
    const dear = minimumViablePrice(recipe, { ...DEFAULT_COST_MODEL, deliverySar: 40 });
    const cheap = minimumViablePrice(recipe, { ...DEFAULT_COST_MODEL, deliverySar: 12 });
    expect(dear).toBeGreaterThan(cheap);
  });
});
