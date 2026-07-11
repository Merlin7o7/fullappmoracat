import { describe, expect, it } from "vitest";
import { recommendPlan, type ApiPlan, type RecommendableCat } from "./plan-recommend";

/** Mirror of the seeded catalogue's food quantities (packages/db seed). */
const PLANS: ApiPlan[] = [
  {
    id: "p-ess", tier: "ESSENTIAL", nameEn: "Essential", nameAr: "الأساسية", price: 179,
    contents: [
      { label: "Dry food — mass (kg)", quantity: 2, unit: "kg" },
      { label: "Wet pouch — mass", quantity: 15, unit: "pouch" },
      { label: "Treats (packs)", quantity: 1, unit: "pack" },
    ],
  },
  {
    id: "p-pre", tier: "PREMIUM", nameEn: "Premium", nameAr: "المميزة", price: 269,
    contents: [
      { label: "Dry food — premium (kg)", quantity: 2, unit: "kg" },
      { label: "Wet pouch — premium", quantity: 20, unit: "pouch" },
    ],
  },
  {
    id: "p-cc", tier: "COMPLETE_CARE", nameEn: "Complete Care", nameAr: "العناية الكاملة", price: 389,
    contents: [
      { label: "Dry food — premium (kg)", quantity: 2.5, unit: "kg" },
      { label: "Wet pouch — premium", quantity: 25, unit: "pouch" },
    ],
  },
  {
    id: "p-mc", tier: "MULTI_CAT", nameEn: "Multi-Cat", nameAr: "متعدد القطط", price: 329,
    contents: [
      { label: "Dry food — mass (kg)", quantity: 3.5, unit: "kg" },
      { label: "Wet pouch — mass", quantity: 30, unit: "pouch" },
    ],
  },
];

const yearsAgo = (y: number) => new Date(Date.now() - y * 365.25 * 24 * 3600 * 1000).toISOString();

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

  it("a typical neutered indoor adult fits Essential", () => {
    const rec = recommendPlan([cat()], PLANS);
    expect(rec?.tier).toBe("ESSENTIAL");
    // Transparent reasons: weight is named with the cat.
    expect(rec?.reasons.some((r) => r.en.includes("Simba's weight (4.5 kg)"))).toBe(true);
    expect(rec!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("a big high-activity cat outgrows Essential → Premium", () => {
    const rec = recommendPlan([cat({ weightKg: 6.5, activityLevel: "HIGH", isNeutered: false })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
  });

  it("a senior maps to Complete Care", () => {
    const rec = recommendPlan([cat({ birthDate: yearsAgo(12) })], PLANS);
    expect(rec?.tier).toBe("COMPLETE_CARE");
  });

  it("health conditions map to Complete Care", () => {
    const rec = recommendPlan([cat({ healthConditionNames: ["CKD"] })], PLANS);
    expect(rec?.tier).toBe("COMPLETE_CARE");
    expect(rec?.reasons.some((r) => r.en.includes("health record"))).toBe(true);
  });

  it("two or more cats map to Multi-Cat regardless of profiles", () => {
    const rec = recommendPlan([cat(), cat({ id: "c2", name: "Luna", birthDate: yearsAgo(12) })], PLANS);
    expect(rec?.tier).toBe("MULTI_CAT");
  });

  it("missing weight falls back honestly with lowered confidence + a nudge", () => {
    const rec = recommendPlan([cat({ weightKg: null })], PLANS);
    expect(rec).not.toBeNull();
    expect(rec!.confidence).toBeLessThan(0.9);
    expect(rec!.reasons.some((r) => r.en.includes("isn't recorded"))).toBe(true);
  });
});
