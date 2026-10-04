import { describe, expect, it } from "vitest";
import { catGender, catPossessive, catPronoun, catSuffix, catVerb, formatCats } from "../src/grammar";
import { formatMonths } from "../src/format";

describe("catGender", () => {
  it("keeps MALE / FEMALE and folds everything else into UNKNOWN", () => {
    expect(catGender("MALE")).toBe("MALE");
    expect(catGender("FEMALE")).toBe("FEMALE");
    expect(catGender("UNKNOWN")).toBe("UNKNOWN");
    expect(catGender(undefined)).toBe("UNKNOWN");
    expect(catGender(null)).toBe("UNKNOWN");
    expect(catGender("female")).toBe("UNKNOWN");
  });
});

describe("catVerb", () => {
  const forms = { m: "صار", f: "صارت", n: "صار للقط" };
  it("agrees with a known gender", () => {
    expect(catVerb("MALE", forms)).toBe("صار");
    expect(catVerb("FEMALE", forms)).toBe("صارت");
  });
  it("never defaults an unknown cat to the masculine form", () => {
    expect(catVerb("UNKNOWN", forms)).toBe("صار للقط");
    expect(catVerb(undefined, forms)).toBe("صار للقط");
  });
});

describe("catSuffix / catPossessive", () => {
  it("attaches the right pronoun", () => {
    expect(catSuffix("MALE")).toBe("ه");
    expect(catSuffix("FEMALE")).toBe("ها");
    expect(catSuffix("UNKNOWN")).toBeNull();
    expect(catPossessive("رقم", "MALE", "سمسم")).toBe("رقمه");
    expect(catPossessive("رقم", "FEMALE", "لولو")).toBe("رقمها");
  });
  it("turns a final taa marbuta into taa before the pronoun", () => {
    expect(catPossessive("هوية", "MALE", "سمسم")).toBe("هويته");
    expect(catPossessive("هوية", "FEMALE", "لولو")).toBe("هويتها");
    expect(catPossessive("ذكرى", "FEMALE", "لولو")).toBe("ذكراها");
  });
  it("repeats the name when the gender is unknown", () => {
    expect(catPossessive("رقم", "UNKNOWN", "لولو")).toBe("رقم لولو");
    expect(catPossessive("هوية", null, "لولو")).toBe("هوية لولو");
  });
});

describe("catPronoun", () => {
  it("uses he/she/they in English", () => {
    expect(catPronoun("MALE", "en")).toBe("he");
    expect(catPronoun("FEMALE", "en", { case: "possessive" })).toBe("her");
    expect(catPronoun("UNKNOWN", "en", { case: "object" })).toBe("them");
  });
  it("uses هو / هي in Arabic, and the name when unknown", () => {
    expect(catPronoun("MALE", "ar")).toBe("هو");
    expect(catPronoun("FEMALE", "ar")).toBe("هي");
    expect(catPronoun("UNKNOWN", "ar", { name: "لولو" })).toBe("لولو");
  });
});

describe("counts agree in number", () => {
  it("formatCats uses the dual and both plurals", () => {
    expect(formatCats(1, "ar")).toBe("قطة واحدة");
    expect(formatCats(2, "ar")).toBe("قطتين");
    expect(formatCats(5, "ar")).toBe("5 قطط");
    expect(formatCats(12, "ar")).toBe("12 قطة");
    expect(formatCats(1, "en")).toBe("1 cat");
    expect(formatCats(5, "en")).toBe("5 cats");
  });
  it("formatMonths never prints «12 أشهر»", () => {
    expect(formatMonths(12, "ar")).toBe("12 شهراً");
    expect(formatMonths(6, "ar")).toBe("6 أشهر");
    expect(formatMonths(1, "ar")).toBe("شهر");
  });
});
