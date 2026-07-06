import { describe, it, expect } from "vitest";
import { normalizeName } from "./text";

describe("normalizeName — Arabic-aware search folding", () => {
  it("strips Arabic diacritics (tashkeel) so variants collapse", () => {
    // مِشْمِش (with harakat) folds to the same key as مشمش (without).
    expect(normalizeName("مِشْمِش")).toBe(normalizeName("مشمش"));
  });

  it("removes tatweel (kashida)", () => {
    expect(normalizeName("مشمــش")).toBe(normalizeName("مشمش"));
  });

  it("unifies alef variants", () => {
    expect(normalizeName("أحمد")).toBe(normalizeName("احمد"));
    expect(normalizeName("إيمان")).toBe(normalizeName("ايمان"));
    expect(normalizeName("آدم")).toBe(normalizeName("ادم"));
  });

  it("folds alef-maqsura → yaa and taa-marbuta → haa", () => {
    expect(normalizeName("ليلى")).toBe(normalizeName("ليلي"));
    expect(normalizeName("قطة")).toBe(normalizeName("قطه"));
  });

  it("lowercases + trims + collapses whitespace for Latin names", () => {
    expect(normalizeName("  Simba   Jr ")).toBe("simba jr");
    expect(normalizeName("SIMBA")).toBe("simba");
  });

  it("returns empty string for nullish input", () => {
    expect(normalizeName(null)).toBe("");
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName("")).toBe("");
  });
});
