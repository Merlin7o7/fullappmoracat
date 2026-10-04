import { describe, expect, it } from "vitest";
import { keepsakeMoment, keepsakeLine } from "./keepsake";
import { shareLandingUrl, registerHref } from "./share-url";

const at = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe("keepsakeMoment", () => {
  it("surfaces the birthday within ±14 days", () => {
    const m = keepsakeMoment({ birthDate: "2023-03-10", idIssuedAt: "2025-01-01" }, at("2026-03-01"));
    expect(m).toEqual({ reason: "birthday", year: 2026, days: 9 });
    expect(keepsakeMoment({ birthDate: "2023-03-10" }, at("2026-03-20"))?.days).toBe(-10);
  });

  it("is silent outside the window and without a date", () => {
    expect(keepsakeMoment({ birthDate: "2023-03-10", idIssuedAt: "2025-06-01" }, at("2026-04-15"))).toBeNull();
    expect(keepsakeMoment({}, at("2026-04-15"))).toBeNull();
  });

  it("wraps across the new year", () => {
    const m = keepsakeMoment({ birthDate: "2022-01-03", idIssuedAt: "2024-05-01" }, at("2025-12-28"));
    expect(m?.reason).toBe("birthday");
    expect(m?.days).toBe(6);
  });

  it("only counts a registration anniversary after a real year", () => {
    expect(keepsakeMoment({ idIssuedAt: "2026-09-01" }, at("2026-09-10"))).toBeNull();
    expect(keepsakeMoment({ idIssuedAt: "2025-09-01" }, at("2026-09-10"))).toEqual({ reason: "anniversary", year: 2026, days: -9 });
  });

  it("opens the year that just closed in early January", () => {
    expect(keepsakeMoment({ idIssuedAt: "2025-05-01" }, at("2026-01-08"))).toEqual({ reason: "yearEnd", year: 2025, days: 0 });
    expect(keepsakeMoment({ idIssuedAt: "2025-05-01" }, at("2025-12-22"))).toEqual({ reason: "yearEnd", year: 2025, days: 0 });
    // Registered after the year closed — nothing to keep from it.
    expect(keepsakeMoment({ idIssuedAt: "2026-01-02" }, at("2026-01-08"))).toBeNull();
  });

  it("speaks Arabic counts properly", () => {
    expect(keepsakeLine({ reason: "birthday", year: 2026, days: 2 }, "لولو", true)).toBe("عيد ميلاد لولو بعد يومين");
    expect(keepsakeLine({ reason: "birthday", year: 2026, days: 0 }, "Lulu", false)).toBe("Lulu's birthday today");
  });
});

describe("share attribution URLs", () => {
  it("names the cat and carries ref + src", () => {
    expect(shareLandingUrl({ slug: "lulu-7", code: "AB2CD3E", src: "story" })).toMatch(/\/i\/lulu-7\?ref=AB2CD3E&src=story$/);
    expect(shareLandingUrl({ slug: null, code: null, src: "qr" })).toMatch(/\/i\?src=qr$/);
  });

  it("only forwards well-formed codes into /register", () => {
    expect(registerHref("AB2CD3E", "card")).toBe("/register?ref=AB2CD3E&src=card");
    expect(registerHref("<script>", "card")).toBe("/register?src=card");
    expect(registerHref(null, null)).toBe("/register");
  });
});
