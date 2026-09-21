import { describe, expect, it } from "vitest";
import { decimalOnly, digitsOnly, latinizeDigits } from "../src/digits";

describe("latinizeDigits", () => {
  it("maps Arabic-Indic digits", () => {
    expect(latinizeDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
  it("maps Eastern-Arabic (Persian) digits", () => {
    expect(latinizeDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
  it("leaves everything else alone", () => {
    expect(latinizeDigits("لولو 7 — ٣kg")).toBe("لولو 7 — 3kg");
  });
});

describe("digitsOnly", () => {
  it("keeps a Saudi mobile typed on an Arabic keyboard", () => {
    expect(digitsOnly("٠٥٥ ١٠٩ ٤٨١٤")).toBe("0551094814");
  });
  it("keeps a mixed-script OTP", () => {
    expect(digitsOnly("١2٣4٥6")).toBe("123456");
  });
  it("drops non-digits", () => {
    expect(digitsOnly("+966 (55) 109-4814")).toBe("966551094814");
  });
});

describe("decimalOnly", () => {
  it("accepts the Arabic decimal separator", () => {
    expect(decimalOnly("٤٫٥")).toBe("4.5");
  });
  it("reads a comma as the point and keeps only the first", () => {
    expect(decimalOnly("4,5.2")).toBe("4.52");
  });
  it("passes integers through", () => {
    expect(decimalOnly("١٢")).toBe("12");
  });
});
