import { describe, expect, it } from "vitest";
import { claimState, normalizeSaudiPhone, phoneLast4 } from "../src/claim";

describe("normalizeSaudiPhone", () => {
  it("brings every Saudi spelling to +9665XXXXXXXX", () => {
    for (const raw of ["0501234567", "501234567", "966501234567", "00966501234567", "+966 50 123 4567", "+966-501234567"]) {
      expect(normalizeSaudiPhone(raw)).toBe("+966501234567");
    }
  });
  it("keeps a foreign number in E.164 and rejects garbage", () => {
    expect(normalizeSaudiPhone("+447911123456")).toBe("+447911123456");
    expect(normalizeSaudiPhone("abc")).toBeNull();
    expect(normalizeSaudiPhone("12")).toBeNull();
  });
});

describe("claimState", () => {
  const now = new Date("2026-09-18T12:00:00Z");
  it("is valid until it expires, and claimed beats everything", () => {
    expect(claimState({ expiresAt: "2026-10-01T00:00:00Z", claimedAt: null, revokedAt: null }, now)).toBe("valid");
    expect(claimState({ expiresAt: "2026-09-01T00:00:00Z", claimedAt: null, revokedAt: null }, now)).toBe("expired");
    expect(claimState({ expiresAt: "2026-09-01T00:00:00Z", claimedAt: "2026-08-30T00:00:00Z", revokedAt: null }, now)).toBe("claimed");
    expect(claimState({ expiresAt: "2026-10-01T00:00:00Z", claimedAt: null, revokedAt: "2026-09-10T00:00:00Z" }, now)).toBe("revoked");
  });
});

describe("phoneLast4", () => {
  it("returns the last four digits only", () => {
    expect(phoneLast4("+966501234567")).toBe("4567");
  });
});
