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
 *
 * Consent (audit 2026-10-04, Problem 7 / cookie notice): measurement is
 * opt-in and the decline is real. Nothing is sent — to either sink — and no
 * anonymous id is minted until the visitor taps «موافق». «بدون قياس», or no
 * choice yet, means silence. The choice is stored once and can be changed
 * from the footer («إعدادات القياس»), which reopens the notice.
 */

export type MeasurementConsent = "granted" | "denied";
export const CONSENT_KEY = "moraqat.cookieConsent";
/** Fired whenever the choice changes (detail: MeasurementConsent). */
export const CONSENT_EVENT = "moraqat:consent-changed";
/** Fired to reopen the notice (footer «إعدادات القياس»). */
export const CONSENT_OPEN_EVENT = "moraqat:consent-open";

/** The stored choice, or null when the visitor hasn't chosen. The pre-2026-10
 *  value "1" ("Got it" on a notice with no decline) is not a choice — those
 *  visitors are asked again, honestly, with both options. */
export function readConsent(): MeasurementConsent | null {
  try {
    if (typeof window === "undefined") return null;
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

export function writeConsent(choice: MeasurementConsent): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
    if (choice === "denied") {
      // Declining also forgets the anonymous id a previous "yes" minted.
      localStorage.removeItem(ANON_KEY);
    }
  } catch {
    /* storage blocked — the choice holds for this page view only */
  }
  memoryConsent = choice;
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: choice }));
  } catch {
    /* ignore */
  }
  if (choice === "granted") flushLanding();
}

/** Reopen the measurement notice so the choice can be changed. */
export function openConsentSettings(): void {
  try {
    window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
  } catch {
    /* ignore */
  }
}

/** Survives blocked storage for the current page view. */
let memoryConsent: MeasurementConsent | null = null;
function measurementAllowed(): boolean {
  return (readConsent() ?? memoryConsent) === "granted";
}

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
  if (!measurementAllowed()) return;
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
 *
 * Before a choice the landing is held in memory only (never stored, never
 * sent); if the visitor then taps «موافق» it is sent once, so the first
 * page of a consenting visit still counts. A decline drops it.
 */
let pendingLanding: Params | null = null;

export function trackPageLanded(): void {
  if (typeof window === "undefined") return;
  try {
    const q = new URLSearchParams(window.location.search);
    const props: Params = { path: window.location.pathname.slice(0, 120) };
    for (const key of ["src", "utm_source", "utm_medium", "utm_campaign", "ref"]) {
      const v = q.get(key);
      if (v) props[key] = v.slice(0, 80);
    }
    pendingLanding = props;
    if (measurementAllowed()) flushLanding();
  } catch {
    /* ignore */
  }
}

function flushLanding(): void {
  const props = pendingLanding;
  pendingLanding = null;
  if (!props) return;
  try {
    if (sessionStorage.getItem("moraqat.landed")) return;
    sessionStorage.setItem("moraqat.landed", "1");
  } catch {
    /* ignore */
  }
  track("page_landed", props);
}
