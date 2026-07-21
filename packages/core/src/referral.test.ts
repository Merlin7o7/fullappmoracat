import { describe, it, expect } from "vitest";
import { referralRecognition, REFERRAL_MILESTONES } from "./referral";
import { foundingBenefits, foundingBenefitsFor, isFoundingPriceLocked } from "./census";

describe("referralRecognition", () => {
  it("no brought cats → not a supporter, first milestone ahead", () => {
    const r = referralRecognition(0, "en");
    expect(r.isFoundingSupporter).toBe(false);
    expect(r.brought).toBe(0);
    expect(r.nextMilestone).toBe(1);
    expect(r.toNext).toBe(1);
    expect(r.title).toMatch(/invite/i);
  });

  it("one brought cat → founding supporter, honest detail", () => {
    const r = referralRecognition(1, "en");
    expect(r.isFoundingSupporter).toBe(true);
    expect(r.nextMilestone).toBe(3);
    expect(r.toNext).toBe(2);
    expect(r.detail).toContain("1 cat");
  });

  it("past the last milestone → nextMilestone null, toNext 0", () => {
    const r = referralRecognition(25, "en");
    expect(r.nextMilestone).toBeNull();
    expect(r.toNext).toBe(0);
    expect(r.isFoundingSupporter).toBe(true);
  });

  it("localizes Arabic without crashing and uses Arabic-Indic digits", () => {
    const r = referralRecognition(3, "ar");
    expect(r.title).toBe("داعم التعداد");
    expect(r.detail).toContain("٣");
  });

  it("guards against negative / non-finite input", () => {
    expect(referralRecognition(-5, "en").brought).toBe(0);
    expect(referralRecognition(NaN, "en").brought).toBe(0);
  });

  it("milestones are the documented thresholds", () => {
    expect([...REFERRAL_MILESTONES]).toEqual([1, 3, 5, 10]);
  });
});

describe("founding benefits", () => {
  it("lists the four promised benefits in both locales", () => {
    for (const locale of ["ar", "en"] as const) {
      const b = foundingBenefits(locale);
      expect(b.map((x) => x.key).sort()).toEqual(
        ["early_access", "first_tag", "founders_wall", "price_lock"].sort()
      );
    }
  });

  it("a founding cat earns the benefits; a non-founding cat earns none", () => {
    expect(foundingBenefitsFor(1, "en").length).toBe(4);
    expect(foundingBenefitsFor(1000, "en").length).toBe(4);
    expect(foundingBenefitsFor(1001, "en").length).toBe(0);
    expect(foundingBenefitsFor(null, "en").length).toBe(0);
  });

  it("price lock is derived from the ordinal, not stored", () => {
    expect(isFoundingPriceLocked(1)).toBe(true);
    expect(isFoundingPriceLocked(1000)).toBe(true);
    expect(isFoundingPriceLocked(1001)).toBe(false);
  });
});
