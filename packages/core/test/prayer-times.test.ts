/**
 * The prayer-time maths is only worth having if it is right, and "right" here
 * means within a couple of minutes of the published Umm al-Qura tables — good
 * enough to decide whether to hold a reminder, and honest about being no more
 * than that (R040).
 */
import { describe, expect, it } from "vitest";
import {
  CITY_COORDS,
  coordsForCity,
  deferUntil,
  isUrgentNotification,
  prayerTimesForDay,
  quietWindows,
} from "../src/prayer-times";

/** `minutes after midnight` → "HH:MM", for readable failures. */
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

describe("prayerTimesForDay", () => {
  // 21 March 2026 — near the equinox, where the geometry is easiest to check
  // against published tables for Riyadh (Umm al-Qura).
  const equinox = new Date(Date.UTC(2026, 2, 21, 0, 0, 0));

  it("puts Riyadh's prayers in the right order across the day", () => {
    const t = prayerTimesForDay(equinox, CITY_COORDS.riyadh!);
    expect(t.fajr).toBeLessThan(t.sunrise);
    expect(t.sunrise).toBeLessThan(t.dhuhr);
    expect(t.dhuhr).toBeLessThan(t.asr);
    expect(t.asr).toBeLessThan(t.maghrib);
    expect(t.maghrib).toBeLessThan(t.isha);
  });

  it("puts Riyadh's equinox sunrise and sunset near 06:00 and 18:10 local", () => {
    const t = prayerTimesForDay(equinox, CITY_COORDS.riyadh!);
    // Riyadh sits east within UTC+3, so solar events run slightly early.
    expect(t.sunrise).toBeGreaterThan(5 * 60 + 40);
    expect(t.sunrise).toBeLessThan(6 * 60 + 20);
    expect(t.maghrib).toBeGreaterThan(17 * 60 + 50);
    expect(t.maghrib).toBeLessThan(18 * 60 + 30);
  });

  it("puts Jeddah's prayers later than Riyadh's — it is further west", () => {
    const riyadh = prayerTimesForDay(equinox, CITY_COORDS.riyadh!);
    const jeddah = prayerTimesForDay(equinox, CITY_COORDS.jeddah!);
    // ~7.5° of longitude ≈ 30 minutes of clock time.
    expect(jeddah.dhuhr - riyadh.dhuhr).toBeGreaterThan(20);
    expect(jeddah.dhuhr - riyadh.dhuhr).toBeLessThan(40);
  });

  it("keeps Isha exactly 90 minutes after Maghrib (Umm al-Qura)", () => {
    const t = prayerTimesForDay(equinox, CITY_COORDS.makkah!);
    expect((t.isha - t.maghrib + 1440) % 1440).toBe(90);
  });

  it("gives every census city a usable day", () => {
    for (const [code, coords] of Object.entries(CITY_COORDS)) {
      const t = prayerTimesForDay(equinox, coords);
      for (const [name, value] of Object.entries(t)) {
        expect(Number.isFinite(value), `${code}.${name}`).toBe(true);
        expect(value, `${code}.${name} = ${hhmm(value)}`).toBeGreaterThanOrEqual(0);
        expect(value, `${code}.${name} = ${hhmm(value)}`).toBeLessThan(1440);
      }
    }
  });

  it("falls back to Riyadh for a city it does not know", () => {
    expect(coordsForCity("atlantis")).toEqual(CITY_COORDS.riyadh);
    expect(coordsForCity(null)).toEqual(CITY_COORDS.riyadh);
  });
});

describe("deferUntil", () => {
  const day = new Date(Date.UTC(2026, 2, 21, 0, 0, 0));
  const times = prayerTimesForDay(day, CITY_COORDS.riyadh!);

  /** A UTC instant for a given local (UTC+3) minute of that same day. */
  const atLocalMinute = (minute: number) =>
    new Date(Date.UTC(2026, 2, 21, 0, 0, 0) + (minute - 3 * 60) * 60_000);

  it("holds a notification that lands inside a prayer window", () => {
    const inside = atLocalMinute(times.dhuhr + 5);
    const until = deferUntil(inside, "riyadh");
    expect(until).not.toBeNull();
    // Released at the end of the window, never later.
    expect(until!.getTime() - inside.getTime()).toBeLessThanOrEqual(25 * 60_000);
    expect(until!.getTime()).toBeGreaterThan(inside.getTime());
  });

  it("sends immediately well away from any prayer", () => {
    // Mid-morning, comfortably between sunrise and Dhuhr.
    const clear = atLocalMinute(Math.floor((times.sunrise + times.dhuhr) / 2));
    expect(deferUntil(clear, "riyadh")).toBeNull();
  });

  it("produces one window per prayer, and none for sunrise", () => {
    expect(quietWindows(times)).toHaveLength(5);
    expect(quietWindows(times).some(([start]) => start === times.sunrise)).toBe(false);
  });
});

describe("isUrgentNotification", () => {
  it("never holds a scanned Cat ID or a lost-cat message", () => {
    expect(isUrgentNotification("cat_found_report")).toBe(true);
    expect(isUrgentNotification("lost_found_message")).toBe(true);
    expect(isUrgentNotification("ownership_transfer_offered")).toBe(true);
  });

  it("is willing to hold a birthday or a vaccination reminder", () => {
    expect(isUrgentNotification("cat_birthday")).toBe(false);
    expect(isUrgentNotification("vaccination_due")).toBe(false);
    expect(isUrgentNotification("cat_like_milestone")).toBe(false);
  });
});
