import { describe, expect, it } from "vitest";
import {
  formatAge,
  formatDate,
  formatHijri,
  formatMonths,
  formatNumber,
  formatPercent,
  formatRelative,
  formatSAR,
  formatWeight,
} from "../src";

const hasArabicIndic = (s: string) => /[\u0660-\u0669\u06F0-\u06F9]/.test(s);

describe("one digit system", () => {
  it("prints Western digits in Arabic too", () => {
    for (const s of [
      formatNumber(1234, "ar"),
      formatSAR(199, "ar"),
      formatDate("2026-10-01T12:00:00Z", "ar"),
      formatHijri("2026-10-01T12:00:00Z", "ar"),
      formatPercent(0.05, "ar"),
      formatRelative(new Date(Date.now() - 3 * 86_400_000), "ar"),
    ]) {
      expect(hasArabicIndic(s), s).toBe(false);
    }
  });
});

describe("money", () => {
  it("formats SAR per locale, halalas only when present", () => {
    expect(formatSAR(199, "ar")).toBe("199 ر.س");
    expect(formatSAR(199, "en")).toBe("SAR 199");
    expect(formatSAR(1248.3, "en")).toBe("SAR 1,248.30");
    expect(formatSAR(5, "ar", { isolate: true })).toBe("\u20685 ر.س\u2069");
  });
});

describe("dates", () => {
  it("is Gregorian by default and Hijri only on request", () => {
    expect(formatDate("2026-10-01T12:00:00Z", "en", "medium")).toBe("1 October 2026");
    expect(formatDate("2026-10-01T12:00:00Z", "ar", "medium")).toContain("2026");
    expect(formatHijri("2026-10-01T12:00:00Z", "en")).toMatch(/14\d\d/);
  });
});

describe("Arabic grammar for counts", () => {
  it("uses the dual and the 3–10 / 11+ plurals", () => {
    expect(formatMonths(1, "ar")).toBe("شهر");
    expect(formatMonths(2, "ar")).toBe("شهرين");
    expect(formatMonths(3, "ar")).toBe("3 أشهر");
    expect(formatMonths(12, "ar")).toBe("12 شهراً");
    expect(formatMonths(1, "en")).toBe("1 month");
  });

  it("states a cat's age the way people say it", () => {
    expect(formatAge(0, "ar")).toBe("أقل من شهر");
    expect(formatAge(4, "ar")).toBe("4 أشهر");
    expect(formatAge(14, "ar")).toBe("سنة وشهرين");
    expect(formatAge(24, "ar")).toBe("سنتين");
    expect(formatAge(89, "ar")).toBe("7 سنوات");
    expect(formatAge(14, "en")).toBe("1 year 2 months");
    expect(formatAge(null, "en")).toBeNull();
  });

  it("formats weight with one decimal", () => {
    expect(formatWeight(4.5, "ar")).toBe("4.5 كغ");
    expect(formatWeight(4, "en")).toBe("4 kg");
    expect(formatWeight(4.26, "en")).toBe("4.3 kg");
  });
});
