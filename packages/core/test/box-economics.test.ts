import { describe, expect, it } from "vitest";
import {
  computeBoxEconomics,
  computeModuleEconomics,
  checkBoxInvariants,
  minimumViablePrice,
  DEFAULT_COST_MODEL,
  DEFAULT_INVARIANTS,
  type InvariantKind,
  type RecipeLine,
} from "../src/pricing/box-economics";

const kinds = (violations: { invariant: InvariantKind }[]): InvariantKind[] =>
  violations.map((v) => v.invariant);

/** One-line recipe helper — economics only care about the summed totals. */
const line = (over: Partial<RecipeLine> = {}): RecipeLine => ({
  sku: "basket",
  quantity: 1,
  unitCost: 100,
  unitRetail: 250,
  unitMarket: 200,
  ...over,
});

describe("cost model (MRC-FIN-002 §2 planning figures)", () => {
  it("carries the v2 defaults: packaging 12, delivery 32, fulfilment 8, PSP 2.5%, shrink 2%", () => {
    expect(DEFAULT_COST_MODEL).toEqual({
      packagingSar: 12,
      deliverySar: 32,
      fulfilmentSar: 8,
      pspRate: 0.025,
      shrinkRate: 0.02,
    });
  });

  it("invariants are the four v2 floors, judged against the MARKET", () => {
    expect(DEFAULT_INVARIANTS).toEqual({
      minMarketSaving: -0.1,
      minGrossMargin: 0.4,
      minContribution: 0.16,
      minContributionPostVat: 0.1,
      stressVatRate: 0.15,
    });
  });
});

describe("computeBoxEconomics", () => {
  it("values the basket at MARKET prices (unitMarket), with unitRetail as fallback", () => {
    const e = computeBoxEconomics({
      recipe: [
        line({ sku: "a", quantity: 2, unitCost: 10, unitRetail: 30, unitMarket: 25 }),
        line({ sku: "b", quantity: 1, unitCost: 40, unitRetail: 90, unitMarket: undefined }),
      ],
      boxPrice: 129,
    });
    expect(e.marketValue).toBe(2 * 25 + 90); // fallback to retail when no benchmark
    expect(e.retailValue).toBe(2 * 30 + 90);
    expect(e.goodsCost).toBe(60);
  });

  it("counts every operational cost — goods, shrink, packaging, delivery, fulfilment, PSP", () => {
    const e = computeBoxEconomics({ recipe: [line({ unitCost: 104.75 })], boxPrice: 219 });
    expect(e.shrink).toBeCloseTo(104.75 * 0.02, 2);
    expect(e.paymentFee).toBeCloseTo(219 * 0.025, 2);
    const expected = e.goodsCost + e.shrink + 12 + 32 + 8 + e.paymentFee;
    expect(e.totalCost).toBeCloseTo(expected, 2);
    // Contribution is strictly tighter than the naive (price − goods)/price.
    expect(e.contributionPct).toBeLessThan((219 - e.goodsCost) / 219);
  });

  it("treats VAT as inclusive — registering removes margin, it does not raise the price", () => {
    const e = computeBoxEconomics({ recipe: [line()], boxPrice: 219 });
    expect(e.vatRegistered.netRevenue + e.vatRegistered.vatDue).toBeCloseTo(219, 2);
    expect(e.vatRegistered.contribution).toBeCloseTo(e.contribution - e.vatRegistered.vatDue, 2);
    expect(e.vatRegistered.contributionPct).toBeLessThan(e.contributionPct);
  });
});

describe("invariant 1 — MARKET_VALUE: the member's real alternative is the market, not our shelf", () => {
  it("fails a box priced above its market-benchmark band (the dead v1 trap)", () => {
    // Market basket 200, box 249 → 24.5% ABOVE market; the band allows ≤ +10%.
    // Goods kept cheap so ONLY the market invariant trips.
    const e = computeBoxEconomics({
      recipe: [line({ unitCost: 90, unitRetail: 300, unitMarket: 200 })],
      boxPrice: 249,
    });
    expect(e.marketSavings).toBeLessThan(0);
    const violations = checkBoxInvariants(e);
    expect(kinds(violations)).toEqual(["MARKET_VALUE"]);
    expect(violations[0]!.message).toMatch(/ABOVE its market-benchmark basket/);
  });

  it("permits a necessity tier slightly above market (≤ +10%) — it then claims no savings", () => {
    // Essentials-shaped: 219 vs a 202.45 market basket = +8% (parity band).
    const e = computeBoxEconomics({
      recipe: [line({ unitCost: 105.75, unitRetail: 280, unitMarket: 202.45 })],
      boxPrice: 219,
    });
    expect(e.marketSavingsPct).toBeGreaterThanOrEqual(DEFAULT_INVARIANTS.minMarketSaving);
    expect(kinds(checkBoxInvariants(e))).not.toContain("MARKET_VALUE");
  });
});

describe("invariant 2 — GROSS_MARGIN: 40% goods floor", () => {
  it("fails a box whose goods eat past 60% of price", () => {
    const e = computeBoxEconomics({
      recipe: [line({ unitCost: 200, unitRetail: 450, unitMarket: 400 })],
      boxPrice: 300, // GM 33%
    });
    expect(e.grossMarginPct).toBeLessThan(0.4);
    expect(kinds(checkBoxInvariants(e))).toContain("GROSS_MARGIN");
  });
});

describe("module economics (MRC-FIN-002 §5 — one additional household cat)", () => {
  it("prices the module against INCREMENTAL logistics only, and it must stand alone", () => {
    // Complete-shaped module: per-cat consumables ~150, module price 280.
    const m = computeModuleEconomics({
      perCatRecipe: [line({ unitCost: 150, unitRetail: 300, unitMarket: 250 })],
      modulePrice: 280,
    });
    expect(m.goodsCost).toBe(150);
    expect(m.marketValue).toBe(250);
    // cost = goods×1.02 + 4 + 15 + 2 + price×2.5% = 153 + 21 + 7 = 181
    expect(m.contribution).toBeCloseTo(280 - (150 * 1.02 + 4 + 15 + 2 + 280 * 0.025), 2);
    expect(m.contribution).toBeCloseTo(99, 2);
    // VAT era: contribution − (280 − 280/1.15)
    expect(m.vatContribution).toBeCloseTo(99 - (280 - 280 / 1.15), 1);
    expect(m.vatContribution).toBeGreaterThan(0); // every added cat profitable in its own right
  });
});

describe("minimumViablePrice", () => {
  it("is the lowest price clearing EVERY margin floor (incl. post-VAT)", () => {
    const recipe = [line({ unitCost: 104.75 })];
    const floor = minimumViablePrice(recipe);
    const at = computeBoxEconomics({ recipe, boxPrice: floor });
    expect(
      kinds(checkBoxInvariants(at)).filter((k) => k !== "MARKET_VALUE")
    ).toEqual([]);
    const below = computeBoxEconomics({ recipe, boxPrice: floor - 15 });
    expect(
      kinds(checkBoxInvariants(below)).some((k) => k.startsWith("CONTRIBUTION") || k === "GROSS_MARGIN")
    ).toBe(true);
  });

  it("responds to the cost model rather than assuming fixed logistics", () => {
    const recipe = [line({ unitCost: 104.75 })];
    const dear = minimumViablePrice(recipe, { ...DEFAULT_COST_MODEL, deliverySar: 65 });
    const cheap = minimumViablePrice(recipe, { ...DEFAULT_COST_MODEL, deliverySar: 12 });
    expect(dear).toBeGreaterThan(cheap);
  });
});

describe("happy path — the Complete tier at negotiated COGS (MRC-FIN-002 §7.1)", () => {
  it("329 with ~180 goods and 35 delivery clears every invariant with the §7.1 numbers", () => {
    const recipe = [line({ unitCost: 180, unitRetail: 395, unitMarket: 350 })];
    const e = computeBoxEconomics({
      recipe,
      boxPrice: 329,
      costModel: { ...DEFAULT_COST_MODEL, deliverySar: 35 }, // heavier Complete parcel
    });

    // The §7.1 column, line by line.
    expect(e.grossMarginPct).toBeCloseTo(0.45, 2); // 45.2% negotiated
    expect(e.shrink).toBeCloseTo(3.6, 2);
    expect(e.paymentFee).toBeCloseTo(8.23, 2);
    expect(e.contribution).toBeCloseTo(82.17, 2); // §7.1 ≈ 81.9 (goods rounded here)
    expect(e.contributionPct).toBeCloseTo(0.25, 2); // 24.9%
    expect(e.vatRegistered.vatDue).toBeCloseTo(42.91, 2);
    expect(e.vatRegistered.contribution).toBeCloseTo(39.26, 2); // §7.1 ≈ 39.0
    expect(e.vatRegistered.contributionPct).toBeCloseTo(0.12, 2); // 13.5%

    // A genuine, advertisable saving vs the DIY market basket (~350): +6%.
    expect(e.marketSavings).toBeCloseTo(21, 2);
    expect(e.marketSavingsPct).toBeCloseTo(0.06, 2);

    expect(checkBoxInvariants(e)).toEqual([]);
  });
});
