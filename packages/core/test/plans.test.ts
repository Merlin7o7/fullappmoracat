import { describe, expect, it } from "vitest";
import {
  PLAN_PRICES,
  planPrice,
  householdMonthlyPrice,
  termTotal,
  boxLineQuantity,
  RENEWAL_SHORT,
  RENEWAL_LEGAL,
  RENEWAL_BILLING_NOTE,
  RENEWAL_FAQ_ANSWER,
} from "../src";

describe("plan price list (one source, MRC-FIN-002)", () => {
  it("lists the four official plans at their committed prices", () => {
    expect(PLAN_PRICES.map((p) => [p.slug, p.price, p.modulePrice])).toEqual([
      ["kitten", 199, 180],
      ["starter", 219, 180],
      ["standard", 329, 280],
      ["premium", 479, 400],
    ]);
    expect(planPrice("STANDARD").price).toBe(329);
    expect(planPrice("premium").modulePrice).toBe(400);
  });

  it("prices a household as base + one module per extra cat", () => {
    expect(householdMonthlyPrice(329, 280, 1)).toBe(329);
    expect(householdMonthlyPrice(329, 280, 3)).toBe(889);
  });

  it("applies the shallow prepaid ladder", () => {
    expect(termTotal(219, 3)).toBe(657);
    expect(termTotal(219, 6)).toBe(1248.3);
    expect(termTotal(219, 12)).toBe(2417.76);
  });
});

describe("box quantities for a household", () => {
  it("ships per-cat lines once per cat and shared lines once", () => {
    expect(boxLineQuantity({ quantity: 15, perCat: true }, 3)).toBe(45);
    expect(boxLineQuantity({ quantity: 1, perCat: false }, 3)).toBe(1);
    expect(boxLineQuantity({ quantity: 0.4, perCat: true }, 1)).toBe(1);
  });
});

describe("renewal policy wording", () => {
  it("never claims a default renewal or a 'never' that checkout contradicts", () => {
    for (const t of [RENEWAL_SHORT, RENEWAL_LEGAL, RENEWAL_BILLING_NOTE, RENEWAL_FAQ_ANSWER]) {
      expect(t.ar.length).toBeGreaterThan(20);
      expect(t.en).not.toMatch(/never auto-renew|renew at the end of the term/i);
    }
    expect(RENEWAL_LEGAL.en).toMatch(/off by default/);
  });
});
