/**
 * Conversion-event hook with no analytics of its own.
 *
 * Events are pushed onto `window.dataLayer` — GTM's standard pre-init queue —
 * so the funnel's key moments are distinguishable the instant a tag manager
 * or analytics script is (re)introduced, without touching these call sites.
 * Until then the pushes are inert. Deliberately NOT an analytics runtime:
 * no scripts, no network, no cookies, CSP untouched.
 *
 * PDPL discipline (R106): never push PII — no names, phones, emails, cat
 * names. Params are limited to coarse booleans/numbers about the event.
 */

type TrackEvent =
  | "registration_completed" // account created (census funnel step 1)
  | "cat_id_issued" // the census conversion — a real Cat ID exists
  | "membership_activated"; // paid activation confirmed (commerce only)

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

export function track(event: TrackEvent, params?: Record<string, string | number | boolean>): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...params });
  } catch {
    // Tracking must never break a ceremony.
  }
}
