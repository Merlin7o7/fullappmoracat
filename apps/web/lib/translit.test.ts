import { describe, it, expect } from "vitest";
import { toArabic, toLatin, localizeName, detectScript } from "./translit";

describe("detectScript", () => {
  it("classifies by script", () => {
    expect(detectScript("عبدالرحمن")).toBe("ar");
    expect(detectScript("Abdulrahman")).toBe("en");
    expect(detectScript("123")).toBe("other");
  });
});

describe("toLatin — known Arabic names (dictionary)", () => {
  const cases: [string, string][] = [
    ["عبدالرحمن", "Abdulrahman"],
    ["عبدالله", "Abdullah"],
    ["عبدالعزيز", "Abdulaziz"],
    ["عبدالرحيم", "Abdulrahim"],
    ["محمد", "Mohammed"],
    ["أحمد", "Ahmed"],
    ["إبراهيم", "Ibrahim"],
    ["منصور", "Mansour"],
    ["خالد", "Khalid"],
    ["فيصل", "Faisal"],
  ];
  it.each(cases)("%s → %s", (ar, en) => {
    expect(toLatin(ar)).toBe(en);
  });

  it("resolves the space-separated compound «عبد الرحمن»", () => {
    expect(toLatin("عبد الرحمن")).toBe("Abdulrahman");
  });

  it("handles a known given name + unknown family name (phonetic fallback)", () => {
    // First token is a dictionary hit; the surname falls back to phonetics.
    const out = toLatin("محمد الغامدي");
    expect(out.startsWith("Mohammed ")).toBe(true);
    expect(out.split(" ")).toHaveLength(2);
  });
});

describe("toArabic — known Latin names (dictionary)", () => {
  const cases: [string, string][] = [
    ["Abdulrahman", "عبدالرحمن"],
    ["Abdul Rahman", "عبدالرحمن"],
    ["Abdullah", "عبدالله"],
    ["Mohammed", "محمد"],
    ["Muhammad", "محمد"],
    ["Ahmed", "أحمد"],
    ["Khaled", "خالد"],
  ];
  it.each(cases)("%s → %s", (en, ar) => {
    expect(toArabic(en)).toBe(ar);
  });

  it("falls back to phonetics for an unknown name (no throw, non-empty)", () => {
    const out = toArabic("Zyzzyx");
    expect(out.length).toBeGreaterThan(0);
    expect(detectScript(out)).toBe("ar");
  });
});

describe("localizeName", () => {
  it("returns a same-script name unchanged", () => {
    expect(localizeName("عبدالرحمن", "ar")).toBe("عبدالرحمن");
    expect(localizeName("Abdulrahman", "en")).toBe("Abdulrahman");
  });
  it("transliterates across scripts", () => {
    expect(localizeName("عبدالرحمن", "en")).toBe("Abdulrahman");
    expect(localizeName("Abdullah", "ar")).toBe("عبدالله");
  });
  it("passes through empty / non-script input", () => {
    expect(localizeName("", "ar")).toBe("");
    expect(localizeName(null, "en")).toBe("");
    expect(localizeName("123", "ar")).toBe("123");
  });
});
