/**
 * LAUNCH CONFIGURATION (server) — single source of truth for the pre-launch
 * first-delivery date, mirrored by the web `lib/launch.ts`. Set the date in ONE
 * place: env `LAUNCH_FIRST_DELIVERY=YYYY-MM-DD` (default below). Used to set the
 * first `nextDeliveryAt` and to word confirmation emails. Auto-retires once the
 * date passes (isPreLaunch → false).
 */
export const FIRST_DELIVERY_DATE: string = process.env.LAUNCH_FIRST_DELIVERY || "2026-09-01";

const firstDeliveryDate = () => new Date(`${FIRST_DELIVERY_DATE}T00:00:00`);

/** True while we're still before the launch first-delivery date. */
export function isPreLaunch(now: Date = new Date()): boolean {
  return now.getTime() < firstDeliveryDate().getTime();
}

/**
 * The date a new subscription's first delivery should fall on: the launch date
 * while pre-launch (every founding member's first box ships on the launch date),
 * otherwise the normally-scheduled date.
 */
export function firstDeliveryOn(scheduled: Date): Date {
  return isPreLaunch() ? firstDeliveryDate() : scheduled;
}
