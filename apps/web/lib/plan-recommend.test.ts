import { describe, expect, it } from "vitest";
import { recommendPlan, type ApiPlan, type RecommendableCat } from "./plan-recommend";

/** Mirror of the seeded v2 catalogue (packages/db seed-catalog, MRC-FIN-002):
 *  Kitten 199 · Essentials 219 · Complete 329 · Signature 479, additive ladder. */
const PLANS: ApiPlan[] = [
  {
    id: "p-kitten", tier: "KITTEN", nameEn: "Kitten", nameAr: "قطتي الصغيرة", price: 199,
    modulePriceSar: 180, maxCats: 6,
    marketValue: 192, marketSavings: null, marketSavingsPct: null,
    contents: [
      { label: "Kitten dry food 2kg", quantity: 2, unit: "kg", perCat: true },
      { label: "Kitten wet pouches & cans", quantity: 15, unit: "pouch", perCat: true },
      { label: "Clumping litter 10L", quantity: 1, unit: "bag", perCat: true },
    ],
  },
  {
    id: "p-essentials", tier: "STARTER", nameEn: "Essentials", nameAr: "الأساسيات", price: 219,
    modulePriceSar: 180, maxCats: 6,
    marketValue: 202.45, marketSavings: null, marketSavingsPct: null,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg", perCat: true },
      { label: "Wet food pouches", quantity: 15, unit: "pouch", perCat: true },
      { label: "Clumping litter 10L", quantity: 1, unit: "bag", perCat: true },
    ],
  },
  {
    id: "p-complete", tier: "STANDARD", nameEn: "Complete", nameAr: "العناية الكاملة", price: 329,
    modulePriceSar: 280, maxCats: 6,
    marketValue: 350, marketSavings: 21, marketSavingsPct: 6,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg", perCat: true },
      { label: "Wet food pouches", quantity: 30, unit: "pouch", perCat: true },
      { label: "Clumping litter 10L", quantity: 1, unit: "bag", perCat: true },
      { label: "Creamy treats", quantity: 1, unit: "pack", perCat: false },
    ],
  },
  {
    id: "p-signature", tier: "PREMIUM", nameEn: "Signature", nameAr: "التوقيع", price: 479,
    modulePriceSar: 400, maxCats: 6,
    marketValue: 545, marketSavings: 66, marketSavingsPct: 12,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg", perCat: true },
      { label: "Wet food pouches", quantity: 39, unit: "pouch", perCat: true },
      { label: "Advanced clumping litter 10L", quantity: 1, unit: "bag", perCat: true },
      { label: "Supplement course", quantity: 1, unit: "pack", perCat: false },
    ],
  },
];

const yearsAgo = (y: number) => new Date(Date.now() - y * 365.25 * 24 * 3600 * 1000).toISOString();
const monthsAgo = (m: number) => new Date(Date.now() - m * 30.44 * 24 * 3600 * 1000).toISOString();

const cat = (over: Partial<RecommendableCat> = {}): RecommendableCat => ({
  id: "c1",
  name: "Simba",
  weightKg: 4.5,
  birthDate: yearsAgo(3),
  activityLevel: "MODERATE",
  isIndoor: true,
  isNeutered: true,
  ...over,
});

describe("recommendPlan — the plan is computed from the cat", () => {
  it("returns null with no cats (callers show a welcome, not a tier table)", () => {
    expect(recommendPlan([], PLANS)).toBeNull();
  });

  it("a typical neutered indoor adult fits Essentials", () => {
    const rec = recommendPlan([cat()], PLANS);
    expect(rec?.tier).toBe("STARTER");
    // Transparent reasons: weight is named with the cat.
    expect(rec?.reasons.some((r) => r.en.includes("Simba's weight (4.5 kg)"))).toBe(true);
    expect(rec!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("a big high-activity cat outgrows Essentials → Complete", () => {
    const rec = recommendPlan([cat({ weightKg: 6.5, activityLevel: "HIGH", isNeutered: false })], PLANS);
    expect(rec?.tier).toBe("STANDARD");
  });

  it("a cat under 9 months maps to Kitten FIRST (MRC-FIN-002 §4)", () => {
    const rec = recommendPlan([cat({ birthDate: monthsAgo(5), weightKg: 2.2 })], PLANS);
    expect(rec?.tier).toBe("KITTEN");
    expect(rec?.headline.en).toMatch(/kitten/i);
    expect(rec?.reasons.some((r) => r.en.includes("Under 9 months"))).toBe(true);
  });

  it("the kitten rule outranks even health conditions (stage before everything)", () => {
    const rec = recommendPlan([cat({ birthDate: monthsAgo(6), weightKg: 2, healthConditionNames: ["FLU"] })], PLANS);
    expect(rec?.tier).toBe("KITTEN");
  });

  it("a 10-month-old is no longer a kitten — adult tiers apply", () => {
    const rec = recommendPlan([cat({ birthDate: monthsAgo(10), weightKg: 3.5 })], PLANS);
    expect(rec?.tier).not.toBe("KITTEN");
  });

  it("a senior maps to Signature", () => {
    const rec = recommendPlan([cat({ birthDate: yearsAgo(12) })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
  });

  it("health conditions map to Signature", () => {
    const rec = recommendPlan([cat({ healthConditionNames: ["CKD"] })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
    expect(rec?.reasons.some((r) => r.en.includes("health record"))).toBe(true);
  });

  it("multi-cat households keep the SAME tier — household modules, never a forced top box", () => {
    const rec = recommendPlan([cat(), cat({ id: "c2", name: "Luna" })], PLANS);
    // Two typical adults each fit Essentials; the household stays Essentials.
    expect(rec?.tier).toBe("STARTER");
    expect(rec?.headline.en).toBe("Best for a multi-cat home");
    expect(rec?.reasons.some((r) => r.en.includes("one household subscription covers them all"))).toBe(true);
  });

  it("in a mixed household the hungriest cat sets the shared tier", () => {
    const rec = recommendPlan(
      [cat(), cat({ id: "c2", name: "Tiger", weightKg: 6.5, activityLevel: "HIGH", isNeutered: false })],
      PLANS
    );
    expect(rec?.tier).toBe("STANDARD");
  });

  it("missing weight falls back honestly with lowered confidence + a nudge", () => {
    const rec = recommendPlan([cat({ weightKg: null })], PLANS);
    expect(rec).not.toBeNull();
    expect(rec!.confidence).toBeLessThan(0.9);
    expect(rec!.reasons.some((r) => r.en.includes("isn't recorded"))).toBe(true);
  });
});
