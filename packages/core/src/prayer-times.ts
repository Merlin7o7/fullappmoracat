/**
 * Prayer times, so notification timing can be prayer-aware (R107).
 *
 * WHY THIS IS IN `core` AND NOT A DEPENDENCY
 * The rule it serves is a *product* rule — "never buzz a member's phone during
 * prayer" — and the classification of which notifications may be held is a
 * product decision that belongs beside the times themselves. It is also small,
 * pure and testable, which is what this package is for.
 *
 * WHAT IT COMPUTES
 * Standard solar-position astronomy (NOAA's algorithm), then the five prayer
 * times from solar noon and the sun's altitude, using the **Umm al-Qura**
 * convention followed in Saudi Arabia:
 *   - Fajr   — sun 18.5° below the horizon before sunrise
 *   - Dhuhr  — solar noon (+ a small safety offset)
 *   - Asr    — shadow length = object length + noon shadow (Shafi'i)
 *   - Maghrib— sunset
 *   - Isha   — 90 fixed minutes after Maghrib (120 in Ramadan; see note)
 *
 * WHAT IT DOES *NOT* CLAIM (R040)
 * These are computed times, accurate to a couple of minutes — they are good
 * enough to decide whether to hold a vaccination reminder for twenty minutes.
 * They are **not** an adhan app and must never be presented to a member as
 * authoritative prayer times. The app uses them only to stay out of the way.
 *
 * The Ramadan Isha adjustment is deliberately not applied: it needs a Hijri
 * calendar the platform does not reliably provide, and being 30 minutes
 * conservative in one direction during one month is the harmless error.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Where the cities are
 * ──────────────────────────────────────────────────────────────────────────*/

/** Latitude/longitude for each census city (`SAUDI_CITIES` codes). */
export const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  riyadh: { lat: 24.7136, lng: 46.6753 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  makkah: { lat: 21.3891, lng: 39.8579 },
  madinah: { lat: 24.5247, lng: 39.5692 },
  dammam: { lat: 26.3927, lng: 49.9777 },
  khobar: { lat: 26.2794, lng: 50.209 },
  dhahran: { lat: 26.2361, lng: 50.0393 },
  taif: { lat: 21.2854, lng: 40.4183 },
  buraydah: { lat: 26.326, lng: 43.975 },
  unaizah: { lat: 26.0843, lng: 43.9935 },
  tabuk: { lat: 28.3835, lng: 36.5662 },
  hail: { lat: 27.5114, lng: 41.7208 },
  abha: { lat: 18.2164, lng: 42.5053 },
  khamis: { lat: 18.3, lng: 42.7333 },
  jazan: { lat: 16.8892, lng: 42.5611 },
  najran: { lat: 17.4917, lng: 44.1322 },
  hofuf: { lat: 25.3644, lng: 49.5875 },
  jubail: { lat: 27.0046, lng: 49.6583 },
  yanbu: { lat: 24.0895, lng: 38.0637 },
  qatif: { lat: 26.5196, lng: 50.0115 },
  arar: { lat: 30.9753, lng: 41.0381 },
  sakaka: { lat: 29.9697, lng: 40.2064 },
  bahah: { lat: 20.0129, lng: 41.4677 },
};

/** Riyadh stands in for an unknown city — the Kingdom is one time zone. */
const FALLBACK = CITY_COORDS.riyadh!;

/** Saudi Arabia is UTC+3 year-round; there is no daylight saving. */
export const KSA_UTC_OFFSET_HOURS = 3;

export function coordsForCity(cityCode: string | null | undefined) {
  return (cityCode && CITY_COORDS[cityCode]) || FALLBACK;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Solar position (NOAA)
 * ──────────────────────────────────────────────────────────────────────────*/

const rad = (deg: number) => (deg * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Days since the J2000.0 epoch for a UTC date. */
function julianDay(date: Date): number {
  return date.getTime() / 86_400_000 + 2_440_587.5;
}

interface SunPosition {
  /** Declination in degrees. */
  declination: number;
  /** Equation of time in minutes. */
  equationOfTime: number;
}

function sunPosition(date: Date): SunPosition {
  const d = julianDay(date) - 2_451_545.0;

  // Mean longitude and anomaly.
  const g = rad((357.529 + 0.98560028 * d) % 360);
  const q = (280.459 + 0.98564736 * d) % 360;
  // Apparent (ecliptic) longitude.
  const L = rad((q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) % 360);
  // Obliquity of the ecliptic.
  const e = rad(23.439 - 0.00000036 * d);

  const declination = deg(Math.asin(Math.sin(e) * Math.sin(L)));

  let ra = deg(Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)));
  ra = ((ra % 360) + 360) % 360;
  // Right ascension in hours, then the equation of time in minutes.
  const equationOfTime = (q / 15 - ra / 15) * 60;

  return { declination, equationOfTime: ((equationOfTime + 720) % 1440) - 720 };
}

/**
 * The hour angle (in hours) at which the sun sits at `altitude` degrees.
 * Returns null above the polar circles where that never happens — never in
 * Saudi Arabia, but the caller should not have to assume that.
 */
function hourAngle(altitude: number, lat: number, declination: number): number | null {
  const cosH =
    (Math.sin(rad(altitude)) - Math.sin(rad(lat)) * Math.sin(rad(declination))) /
    (Math.cos(rad(lat)) * Math.cos(rad(declination)));
  if (cosH > 1 || cosH < -1) return null;
  return deg(Math.acos(cosH)) / 15;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The five times
 * ──────────────────────────────────────────────────────────────────────────*/

export interface PrayerTimes {
  /** Minutes after local midnight, in the city's own (UTC+3) day. */
  fajr: number;
  sunrise: number;
  dhuhr: number;
  asr: number;
  maghrib: number;
  isha: number;
}

/** Sun 18.5° below the horizon — the Umm al-Qura Fajr angle. */
const FAJR_ANGLE = -18.5;
/** Isha is a fixed 90 minutes after Maghrib under Umm al-Qura. */
const ISHA_AFTER_MAGHRIB_MIN = 90;
/** Standard atmospheric-refraction allowance at the horizon. */
const HORIZON = -0.833;

/**
 * Prayer times for one calendar day at one place, as minutes after local
 * midnight (UTC+3).
 */
export function prayerTimesForDay(
  date: Date,
  coords: { lat: number; lng: number },
  utcOffsetHours = KSA_UTC_OFFSET_HOURS
): PrayerTimes {
  const { declination, equationOfTime } = sunPosition(date);
  const { lat, lng } = coords;

  // Local solar noon, in local clock hours.
  const noon = 12 + utcOffsetHours - lng / 15 - equationOfTime / 60;

  const h = (altitude: number) => hourAngle(altitude, lat, declination);
  const sunriseH = h(HORIZON);

  // Asr (Shafi'i): the shadow equals the object plus its noon shadow.
  const noonShadow = Math.tan(rad(Math.abs(lat - declination)));
  const asrAltitude = deg(Math.atan(1 / (1 + noonShadow)));
  const asrH = h(asrAltitude);
  const fajrH = h(FAJR_ANGLE);

  const toMinutes = (hours: number) => Math.round(((hours % 24) + 24) % 24 * 60);

  const maghrib = toMinutes(noon + (sunriseH ?? 6));
  return {
    fajr: toMinutes(noon - (fajrH ?? 7.5)),
    sunrise: toMinutes(noon - (sunriseH ?? 6)),
    // A minute past true noon: Dhuhr is never *before* the sun crosses.
    dhuhr: toMinutes(noon + 1 / 60),
    asr: toMinutes(noon + (asrH ?? 3.5)),
    maghrib,
    isha: (maghrib + ISHA_AFTER_MAGHRIB_MIN) % 1440,
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * The product rule
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * How long after a prayer begins the phone stays quiet.
 *
 * Deliberately modest: this is about not interrupting, not about enforcing
 * anything. Long enough to cover the adhan, the walk and the prayer; short
 * enough that a reminder is never held for an hour.
 */
export const PRAYER_QUIET_MINUTES = 25;

/** The quiet windows for a day, as `[startMinute, endMinute]` pairs. */
export function quietWindows(times: PrayerTimes): [number, number][] {
  // Sunrise is not a prayer; it is excluded on purpose.
  return [times.fajr, times.dhuhr, times.asr, times.maghrib, times.isha].map(
    (start) => [start, start + PRAYER_QUIET_MINUTES] as [number, number]
  );
}

/**
 * Should a non-urgent notification wait, and if so until when?
 *
 * Returns the `Date` to send at, or `null` to send now. Urgent notifications
 * never reach this function — a lost cat being scanned is not something to
 * hold for twenty minutes (R107 serves care, it does not outrank it).
 */
export function deferUntil(
  now: Date,
  cityCode: string | null | undefined,
  utcOffsetHours = KSA_UTC_OFFSET_HOURS
): Date | null {
  const coords = coordsForCity(cityCode);
  const times = prayerTimesForDay(now, coords, utcOffsetHours);

  // Minutes after local midnight, for the city's own clock.
  const localMs = now.getTime() + utcOffsetHours * 3_600_000;
  const local = new Date(localMs);
  const minuteOfDay = local.getUTCHours() * 60 + local.getUTCMinutes();

  for (const [start, end] of quietWindows(times)) {
    if (minuteOfDay >= start && minuteOfDay < end) {
      return new Date(now.getTime() + (end - minuteOfDay) * 60_000);
    }
  }
  return null;
}

/**
 * Notification types that are never held.
 *
 * The test is simple: would a member be angry to learn we sat on this for
 * twenty minutes? A cat was scanned, a stranger messaged about a lost cat, a
 * payment failed, someone wants to hand a cat over — all of those, yes.
 */
export const URGENT_NOTIFICATION_TYPES = new Set<string>([
  "cat_found_report",
  "lost_found_message",
  "lost_found_possible_match",
  "ownership_transfer_offered",
  "ownership_transfer_completed_to",
  "adoption_request_received",
  "adoption_request_accepted",
  "payment_failed",
  "renewal_payment_failed",
  "password_changed",
  "password_reset_requested",
  "support_replied",
]);

export function isUrgentNotification(type: string): boolean {
  return URGENT_NOTIFICATION_TYPES.has(type);
}
