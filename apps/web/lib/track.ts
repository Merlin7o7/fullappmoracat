import { isClientEvent, type ClientEvent } from "@moraqat/core";

/**
 * Conversion + product events.
 *
 * Two sinks, deliberately separate:
 *
 *  1. `window.dataLayer` — GTM's pre-init queue, so a tag manager can pick the
 *     funnel moments up the day one is (re)introduced. Inert until then.
 *  2. `POST /events` — Moracat's own first-party event log (MRC-PROD-001 T2).
 *     Only the allow-listed client names are accepted; everything with money
 *     or identity in it is recorded server-side by the service that owns it.
 *
 * PDPL discipline (R106): never push PII — no names, phones, emails, cat
 * names. Params are coarse booleans/numbers/short strings about the event.
 */

type LegacyEvent =
  | "registration_completed" // account created (census funnel step 1)
  | "cat_id_issued" // the census conversion — a real Cat ID exists
  | "membership_activated"; // paid activation confirmed (commerce only)

type TrackEvent = LegacyEvent | ClientEvent;
type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

const ANON_KEY = "moraqat.anonId";
const API = process.env.NEXT_PUBLIC_API_BASE_URL;

/** A random, non-identifying browser id so a funnel can be followed before sign-up. */
function anonId(): string | undefined {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

function accessToken(): string | undefined {
  try {
    // Same envelope lib/auth.tsx persists: { user, tokens: { accessToken } }.
    const raw = localStorage.getItem("moraqat.auth");
    return raw ? (JSON.parse(raw) as { tokens?: { accessToken?: string } }).tokens?.accessToken : undefined;
  } catch {
    return undefined;
  }
}

/** Fire-and-forget POST to the event log; a failure is silent by design. */
function postEvent(name: ClientEvent, props?: Params): void {
  if (!API) return;
  try {
    const token = accessToken();
    void fetch(`${API}/api/events`, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ name, anonId: anonId(), props }),
    }).catch(() => undefined);
  } catch {
    /* never break the page for a metric */
  }
}

export function track(event: TrackEvent, params?: Params): void {
  if (typeof window === "undefined") return;
  try {
    window.dataLayer = window.dataLayer ?? [];
    window.dataLayer.push({ event, ...params });
  } catch {
    // Tracking must never break a ceremony.
  }
  if (isClientEvent(event)) postEvent(event, params);
}

/**
 * Record the landing once per browser session, with the attribution that was
 * on the URL. Called from the root providers so every entry point counts.
 */
export function trackPageLanded(): void {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem("moraqat.landed")) return;
    sessionStorage.setItem("moraqat.landed", "1");
    const q = new URLSearchParams(window.location.search);
    const props: Params = { path: window.location.pathname.slice(0, 120) };
    for (const key of ["src", "utm_source", "utm_medium", "utm_campaign", "ref"]) {
      const v = q.get(key);
      if (v) props[key] = v.slice(0, 80);
    }
    track("page_landed", props);
  } catch {
    /* ignore */
  }
}
