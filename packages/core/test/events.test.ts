import { describe, expect, it } from "vitest";
import { isClientEvent, sanitizeEventProps, sanitizeFirstTouch } from "../src/events";
import { riyadhDayBounds } from "../src/metrics";

describe("sanitizeEventProps", () => {
  it("drops anything that looks like personal data (R106)", () => {
    const out = sanitizeEventProps({
      origin: "clinic",
      ownerPhone: "+966500000000",
      email: "x@y.z",
      catName: "Luna",
      count: 3,
    });
    expect(out).toEqual({ origin: "clinic", count: 3 });
  });

  it("clips long strings and refuses nested objects", () => {
    const out = sanitizeEventProps({ path: "a".repeat(500), nested: { a: 1 } });
    expect(out?.path).toHaveLength(200);
    expect(out).not.toHaveProperty("nested");
  });

  it("returns null for empty or non-object input", () => {
    expect(sanitizeEventProps(null)).toBeNull();
    expect(sanitizeEventProps("x")).toBeNull();
    expect(sanitizeEventProps({ Email: "a" })).toBeNull();
  });
});

describe("sanitizeFirstTouch", () => {
  it("keeps only the attribution keys, clipped", () => {
    const out = sanitizeFirstTouch({
      src: "stand-004",
      utm_source: "snapchat",
      junk: "x",
      landingPath: "/".padEnd(300, "a"),
    });
    expect(out).toEqual({ src: "stand-004", utm_source: "snapchat", landingPath: "/".padEnd(120, "a") });
  });

  it("is null when nothing survives", () => {
    expect(sanitizeFirstTouch({ junk: 1 })).toBeNull();
  });
});

describe("isClientEvent", () => {
  it("accepts only the public allow-list", () => {
    expect(isClientEvent("page_landed")).toBe(true);
    expect(isClientEvent("cat_id_issued")).toBe(false);
    expect(isClientEvent(42)).toBe(false);
  });
});

describe("riyadhDayBounds", () => {
  it("buckets by the Riyadh calendar day, not UTC", () => {
    // 22:30 UTC on the 1st is 01:30 on the 2nd in Riyadh.
    const b = riyadhDayBounds(new Date("2026-09-01T22:30:00Z"));
    expect(b.day).toBe("2026-09-02");
    expect(b.start.toISOString()).toBe("2026-09-01T21:00:00.000Z");
    expect(b.end.toISOString()).toBe("2026-09-02T21:00:00.000Z");
  });
});
