import type { FirstTouch } from "@moraqat/core";

/** Cookie the edge middleware writes on a visitor's first landing. */
export const FIRST_TOUCH_COOKIE = "mrc_ft";

/**
 * Read the first-touch attribution the middleware stored. Returned as-is; the
 * API re-sanitises before it is written to the account, so a tampered cookie
 * can at worst attribute a signup to a made-up campaign.
 */
export function readFirstTouch(): FirstTouch | undefined {
  if (typeof document === "undefined") return undefined;
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${FIRST_TOUCH_COOKIE}=`))
      ?.slice(FIRST_TOUCH_COOKIE.length + 1);
    if (!raw) return undefined;
    const parsed = JSON.parse(decodeURIComponent(raw)) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as FirstTouch) : undefined;
  } catch {
    return undefined;
  }
}
