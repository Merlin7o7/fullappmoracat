/**
 * LAUNCH CONFIGURATION — single source of truth for the pre-launch first-delivery
 * date. Every surface references this; never hardcode "1 September" in a component.
 *
 * Change the date in ONE place: set NEXT_PUBLIC_LAUNCH_FIRST_DELIVERY=YYYY-MM-DD
 * (defaults below). Once the date passes, `isPreLaunch()` flips to false and the
 * launch messaging auto-retires everywhere — surfaces then show the member's real
 * next scheduled delivery instead of the launch date.
 */
import { formatDate } from "./datetime";

/** First Moracat box ships for delivery starting this date (ISO yyyy-mm-dd). */
export const FIRST_DELIVERY_DATE: string =
  process.env.NEXT_PUBLIC_LAUNCH_FIRST_DELIVERY || "2026-09-01";

const firstDeliveryMs = () => new Date(`${FIRST_DELIVERY_DATE}T00:00:00`).getTime();

/** True while we're still before the launch first-delivery date. */
export function isPreLaunch(now: Date = new Date()): boolean {
  return now.getTime() < firstDeliveryMs();
}

/** Human date for the launch first delivery, localised. */
export function firstDeliveryLabel(locale: "ar" | "en"): string {
  return formatDate(FIRST_DELIVERY_DATE, locale, { day: "numeric", month: "long", year: "numeric" });
}

/**
 * The delivery date to SHOW a member: the launch date while pre-launch, otherwise
 * their real scheduled delivery. `isLaunch` lets the UI switch copy ("ships
 * starting …" vs "next delivery …").
 */
export function effectiveNextDelivery(
  scheduled: string | null,
  now?: Date
): { date: string | null; isLaunch: boolean } {
  if (isPreLaunch(now)) return { date: FIRST_DELIVERY_DATE, isLaunch: true };
  return { date: scheduled, isLaunch: false };
}
