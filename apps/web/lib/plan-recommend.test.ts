import { describe, expect, it } from "vitest";
import { recommendPlan, type ApiPlan, type RecommendableCat } from "./plan-recommend";

/** Mirror of the seeded catalogue's food quantities (packages/db seed-catalog). */
const PLANS: ApiPlan[] = [
  {
    id: "p-starter", tier: "STARTER", nameEn: "Starter", nameAr: "المبتدئة", price: 249,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg" },
      { label: "Wet food pouches", quantity: 15, unit: "pouch" },
      { label: "Creamy treats", quantity: 1, unit: "pack" },
    ],
  },
  {
    id: "p-standard", tier: "STANDARD", nameEn: "Standard", nameAr: "القياسية", price: 349,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg" },
      { label: "Premium wet pouches", quantity: 15, unit: "pouch" },
      { label: "Clumping litter 10L", quantity: 1, unit: "bag" },
    ],
  },
  {
    id: "p-premium", tier: "PREMIUM", nameEn: "Premium", nameAr: "المميّزة", price: 529,
    contents: [
      { label: "Dry food 2kg", quantity: 2, unit: "kg" },
      { label: "Premium wet pouches", quantity: 24, unit: "pouch" },
      { label: "Premium litter 10L", quantity: 1, unit: "bag" },
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

  it("a typical neutered indoor adult fits Starter", () => {
    const rec = recommendPlan([cat()], PLANS);
    expect(rec?.tier).toBe("STARTER");
    // Transparent reasons: weight is named with the cat.
    expect(rec?.reasons.some((r) => r.en.includes("Simba's weight (4.5 kg)"))).toBe(true);
    expect(rec!.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("a big high-activity cat outgrows Starter → Standard", () => {
    const rec = recommendPlan([cat({ weightKg: 6.5, activityLevel: "HIGH", isNeutered: false })], PLANS);
    expect(rec?.tier).toBe("STANDARD");
  });

  it("a senior maps to Premium", () => {
    const rec = recommendPlan([cat({ birthDate: yearsAgo(12) })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
  });

  it("health conditions map to Premium", () => {
    const rec = recommendPlan([cat({ healthConditionNames: ["CKD"] })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
    expect(rec?.reasons.some((r) => r.en.includes("health record"))).toBe(true);
  });

  it("two or more cats map to Premium regardless of profiles", () => {
    const rec = recommendPlan([cat(), cat({ id: "c2", name: "Luna", birthDate: yearsAgo(12) })], PLANS);
    expect(rec?.tier).toBe("PREMIUM");
  });

  it("missing weight falls back honestly with lowered confidence + a nudge", () => {
    const rec = recommendPlan([cat({ weightKg: null })], PLANS);
    expect(rec).not.toBeNull();
    expect(rec!.confidence).toBeLessThan(0.9);
    expect(rec!.reasons.some((r) => r.en.includes("isn't recorded"))).toBe(true);
  });
});
