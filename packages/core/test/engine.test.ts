import { describe, it, expect } from "vitest";
import { calculateFeeding } from "../src/feeding/engine";
import type { FeedingInput } from "../src/feeding/types";

const adultIndoor: FeedingInput = {
  weightKg: 4.5,
  ageMonths: 36,
  activity: "MODERATE",
  isIndoor: true,
  neutered: true,
  bodyCondition: "IDEAL",
};

describe("calculateFeeding — RER/MER methodology", () => {
  it("computes RER as 70 × BW^0.75", () => {
    const r = calculateFeeding(adultIndoor);
    // 70 * 4.5^0.75 ≈ 216 kcal
    expect(r.rationale.restingEnergyKcal).toBeGreaterThan(210);
    expect(r.rationale.restingEnergyKcal).toBeLessThan(222);
  });

  it("neutered adult uses a 1.2 maintenance factor", () => {
    const r = calculateFeeding(adultIndoor);
    expect(r.rationale.energyFactor).toBeCloseTo(1.2, 3);
    // Daily calories ≈ 216 * 1.2 ≈ 259
    expect(r.dailyCalories).toBeGreaterThan(245);
    expect(r.dailyCalories).toBeLessThan(275);
  });

  it("intact adults need more food than neutered ones", () => {
    const neutered = calculateFeeding({ ...adultIndoor, neutered: true });
    const intact = calculateFeeding({ ...adultIndoor, neutered: false });
    expect(intact.dailyCalories).toBeGreaterThan(neutered.dailyCalories);
  });

  it("kittens need more energy per kg than adults", () => {
    const kitten = calculateFeeding({ weightKg: 2, ageMonths: 5, activity: "HIGH", isIndoor: true });
    const adult = calculateFeeding({ weightKg: 2, ageMonths: 36, activity: "HIGH", isIndoor: true, neutered: true });
    expect(kitten.rationale.energyFactor).toBeGreaterThan(adult.rationale.energyFactor);
  });

  it("overweight cats get calorie-restricted", () => {
    const ideal = calculateFeeding({ ...adultIndoor, bodyCondition: "IDEAL" });
    const over = calculateFeeding({ ...adultIndoor, bodyCondition: "OVERWEIGHT" });
    expect(over.dailyCalories).toBeLessThan(ideal.dailyCalories);
  });
});

describe("calculateFeeding — quantities & outputs", () => {
  it("splits calories dry/wet per dryShare", () => {
    const r = calculateFeeding({ ...adultIndoor, dryShare: 0.7 });
    expect(r.dryFoodGramsPerDay).toBeGreaterThan(0);
    expect(r.wetPouchesPerMonth).toBeGreaterThan(0);
  });

  it("all-dry diet produces zero wet pouches", () => {
    const r = calculateFeeding({ ...adultIndoor, dryShare: 1 });
    expect(r.wetPouchesPerMonth).toBe(0);
    expect(r.dryFoodKgPerMonth).toBeGreaterThan(0);
  });

  it("multi-cat households need proportionally more litter", () => {
    const one = calculateFeeding({ ...adultIndoor, cats: 1 });
    const three = calculateFeeding({ ...adultIndoor, cats: 3 });
    expect(three.litterKgPerMonth).toBeCloseTo(one.litterKgPerMonth * 3, 1);
  });

  it("indoor cats use more litter than outdoor cats", () => {
    const indoor = calculateFeeding({ ...adultIndoor, isIndoor: true });
    const outdoor = calculateFeeding({ ...adultIndoor, isIndoor: false });
    expect(indoor.litterKgPerMonth).toBeGreaterThan(outdoor.litterKgPerMonth);
  });

  it("seniors and cats with health conditions get a supplement", () => {
    const senior = calculateFeeding({ ...adultIndoor, lifeStage: "SENIOR" });
    const sick = calculateFeeding({ ...adultIndoor, hasHealthConditions: true });
    expect(senior.supplementsPerMonth).toBe(1);
    expect(sick.supplementsPerMonth).toBe(1);
  });

  it("produces a positive cost estimate", () => {
    const r = calculateFeeding(adultIndoor);
    expect(r.estimatedMonthlyCostSar).toBeGreaterThan(0);
  });
});

describe("calculateFeeding — confidence & fallbacks", () => {
  it("full profile yields high confidence", () => {
    const r = calculateFeeding(adultIndoor);
    expect(r.confidence).toBeGreaterThanOrEqual(0.9);
    expect(r.rationale.weightSource).toBe("measured");
  });

  it("falls back to breed average when weight is missing", () => {
    const r = calculateFeeding({ activity: "MODERATE", isIndoor: true, breedAvgWeightKg: 5 });
    expect(r.rationale.weightSource).toBe("breed-average");
    expect(r.rationale.resolvedWeightKg).toBe(5);
    expect(r.confidence).toBeLessThan(0.9);
  });

  it("falls back to a default when nothing is known", () => {
    const r = calculateFeeding({ activity: "MODERATE", isIndoor: true });
    expect(r.rationale.weightSource).toBe("default");
    expect(r.rationale.resolvedWeightKg).toBe(4);
  });

  it("clamps absurd weights into a sane range", () => {
    const r = calculateFeeding({ weightKg: 99, activity: "LOW", isIndoor: true });
    expect(r.rationale.resolvedWeightKg).toBeLessThanOrEqual(15);
  });
});
