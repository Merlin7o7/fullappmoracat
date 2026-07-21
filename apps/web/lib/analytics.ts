/**
 * Cat Census web-analytics layer — consent-gated, provider-agnostic.
 *
 * Why this exists, and why it's shaped this way:
 *  - Saudi PDPL + Design Authority R106 ("PDPL + in-region data + say so plainly")
 *    make analytics strictly OPT-IN. Nothing is sent to any third party until the
 *    member has actively chosen "accept". Decline is the standing default (R006 —
 *    no dark patterns), so this module treats an *undecided* visitor exactly like a
 *    declined one for the purpose of network calls: it never fires.
 *  - The funnel-wiring engineer calls only the small public API below. The provider
 *    fan-out (GA4 / Meta / TikTok / Snap / Clarity) is an implementation detail that
 *    can change without touching a single call site.
 *  - Everything is SSR-safe: this file is imported by client components but its
 *    top level must never touch `window`, so all browser access is guarded and lazy.
 *
 * PRIVACY CONTRACT (do not weaken): only non-identifying, aggregate-safe params are
 * ever forwarded (cat_number, city code, source, channel, location, label). As a
 * belt-and-suspenders guard, `sanitizeParams` drops any key that looks like PII even
 * if a caller passes it by mistake — a silent leak is worse than a dropped dimension.
 */

export type AnalyticsEvent =
  | "hero_name_entered"
  | "cta_click"
  | "registration_started"
  | "sign_up"
  | "login"
  | "cat_creation_started"
  | "cat_registered"
  | "cat_id_revealed"
  | "share_click"
  | "referral_invite_sent"
  | "referral_link_copied"
  | "public_opt_in"
  | "waitlist_join"
  | "census_view";

export type AnalyticsParams = Record<string, string | number | boolean>;

type ConsentState = "granted" | "denied";

const CONSENT_KEY = "moraqat.analytics.consent";

// --- Third-party globals injected by the pixel init snippets (see pixels.tsx). ---
// Declared loosely on purpose: we only ever *call* these; their real shapes live in
// each vendor's SDK. Each snippet defines a synchronous stub that queues calls until
// its network script loads, so calling them right after consent is safe.
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    ttq?: { track?: (name: string, params?: Record<string, unknown>) => void; page?: () => void };
    snaptr?: (...args: unknown[]) => void;
    clarity?: (...args: unknown[]) => void;
  }
}

/* -------------------------------------------------------------------------- */
/*  Consent state                                                             */
/* -------------------------------------------------------------------------- */

// Cached in-module so `hasConsent()` is cheap and synchronous after first read.
// `undefined` = not yet read from storage; `null` = read, but the member hasn't chosen.
let consentCache: ConsentState | null | undefined;

const listeners = new Set<(granted: boolean) => void>();

/** Read the persisted choice, tolerating SSR and locked-down storage. */
function readConsent(): ConsentState | null {
  if (consentCache !== undefined) return consentCache;
  if (typeof window === "undefined") return null; // SSR — decide nothing on the server
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    consentCache = raw === "granted" || raw === "denied" ? raw : null;
  } catch {
    // Private-mode / storage-disabled — treat as undecided, never as consent.
    consentCache = null;
  }
  return consentCache;
}

function persistConsent(state: ConsentState): void {
  consentCache = state;
  try {
    window.localStorage.setItem(CONSENT_KEY, state);
  } catch {
    // If we can't persist we still honour the choice for this session via the cache;
    // the banner may reappear next visit, which fails safe (asks again, never assumes).
  }
}

function notify(granted: boolean): void {
  for (const cb of listeners) {
    try {
      cb(granted);
    } catch {
      /* a broken subscriber must never break analytics */
    }
  }
}

export function hasConsent(): boolean {
  return readConsent() === "granted";
}

/**
 * Raw tri-state for UI that must distinguish "not yet chosen" from "declined"
 * (the consent banner shows only while `null`). Not part of the funnel-tracking
 * contract — `track`/`hasConsent` are all the funnel needs.
 */
export function getConsentState(): "granted" | "denied" | null {
  return readConsent();
}

export function grantConsent(): void {
  if (typeof window === "undefined") return;
  persistConsent("granted");
  notify(true);
  // Defer the flush a tick so the pixel scripts (which mount in reaction to this same
  // consent change) have a chance to define their stubs first. `flushPendingEvents`
  // is idempotent, and pixels.tsx re-runs it once mounted, so nothing is lost or doubled.
  scheduleFlush();
}

export function denyConsent(): void {
  if (typeof window === "undefined") return;
  persistConsent("denied");
  buffer.length = 0; // never keep anything we've been told not to collect
  notify(false);
}

/**
 * Subscribe to consent changes. Returns an unsubscribe fn. Used by the pixels
 * component to mount/flush exactly when the member accepts.
 */
export function onConsentChange(cb: (granted: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/* -------------------------------------------------------------------------- */
/*  Pre-consent buffer                                                        */
/* -------------------------------------------------------------------------- */

type BufferedEvent = { event: AnalyticsEvent; params?: AnalyticsParams };

// Events fired while the visitor is still undecided are held here (never sent),
// then flushed the instant they accept — so we don't lose the first-touch signal
// (e.g. `census_view`) to the few seconds a person spends reading the banner.
// Capped so a decline-forever visitor can't grow this unbounded.
const buffer: BufferedEvent[] = [];
const BUFFER_CAP = 50;

let flushScheduled = false;
function scheduleFlush(): void {
  if (flushScheduled || typeof window === "undefined") return;
  flushScheduled = true;
  window.setTimeout(() => {
    flushScheduled = false;
    flushPendingEvents();
  }, 0);
}

/**
 * Drain the pre-consent buffer to the live providers. Safe to call repeatedly:
 * it no-ops without consent and empties the queue in one pass, so both `grantConsent`
 * and the pixels "ready" effect can call it without double-sending.
 */
export function flushPendingEvents(): void {
  if (!hasConsent() || buffer.length === 0) return;
  const queued = buffer.splice(0, buffer.length);
  for (const { event, params } of queued) dispatch(event, params);
}

/* -------------------------------------------------------------------------- */
/*  Public tracking API                                                       */
/* -------------------------------------------------------------------------- */

export function track(event: AnalyticsEvent, params?: AnalyticsParams): void {
  if (typeof window === "undefined") return;
  const consent = readConsent();
  if (consent === "granted") {
    dispatch(event, params);
    return;
  }
  if (consent === "denied") return; // respect the "no" — drop silently
  // Undecided: hold it until (and only if) they accept.
  if (buffer.length < BUFFER_CAP) buffer.push({ event, params });
}

export function trackPageview(url: string): void {
  if (typeof window === "undefined" || !hasConsent()) return;
  const safeUrl = stripQuery(url); // never forward query strings — they can carry PII
  // GA4: we set send_page_view:false at init, so drive SPA pageviews explicitly.
  window.gtag?.("event", "page_view", { page_path: safeUrl });
  window.fbq?.("track", "PageView");
  window.ttq?.page?.();
  window.snaptr?.("track", "PAGE_VIEW");
  // Clarity auto-tracks SPA navigations via history — no explicit pageview needed.
}

/* -------------------------------------------------------------------------- */
/*  Provider fan-out                                                          */
/* -------------------------------------------------------------------------- */

// Meta standard events (fbq 'track'); anything not listed goes out as 'trackCustom'
// under its own name so no signal is lost.
const META_STANDARD: Partial<Record<AnalyticsEvent, string>> = {
  sign_up: "CompleteRegistration",
  cat_registered: "CompleteRegistration",
  waitlist_join: "Lead",
  public_opt_in: "Lead",
};

// TikTok accepts custom event names directly, so we only remap where a first-class
// standard event improves optimisation.
const TIKTOK_STANDARD: Partial<Record<AnalyticsEvent, string>> = {
  sign_up: "CompleteRegistration",
  cat_registered: "CompleteRegistration",
  cta_click: "ClickButton",
  census_view: "ViewContent",
  waitlist_join: "Subscribe",
};

// Snap only recognises a fixed enum of event types; unmapped events ride on a
// custom slot with their name preserved in params.
const SNAP_STANDARD: Partial<Record<AnalyticsEvent, string>> = {
  sign_up: "SIGN_UP",
  cat_registered: "SIGN_UP",
  census_view: "VIEW_CONTENT",
  cta_click: "PAGE_VIEW",
};

function dispatch(event: AnalyticsEvent, rawParams?: AnalyticsParams): void {
  const params = sanitizeParams(rawParams);

  // GA4 — native custom event name maps 1:1 to our vocabulary.
  window.gtag?.("event", event, params);

  // Meta Pixel — standard where sensible, custom otherwise.
  if (typeof window.fbq === "function") {
    const standard = META_STANDARD[event];
    if (standard) window.fbq("track", standard, params);
    else window.fbq("trackCustom", event, params);
  }

  // TikTok Pixel.
  window.ttq?.track?.(TIKTOK_STANDARD[event] ?? event, params);

  // Snap Pixel.
  if (typeof window.snaptr === "function") {
    const snapType = SNAP_STANDARD[event];
    window.snaptr("track", snapType ?? "CUSTOM_EVENT_1", snapType ? params : { ...params, event });
  }

  // Microsoft Clarity — surface the event as a custom tag for session filtering.
  window.clarity?.("event", event);
}

/* -------------------------------------------------------------------------- */
/*  Safety helpers                                                            */
/* -------------------------------------------------------------------------- */

// Keys that must never leave the device, even if a call site passes them by mistake.
const PII_KEY = /(email|mail|phone|mobile|tel|name|passport|iqama|national|nid|ssn|address|owner)/i;

function sanitizeParams(params?: AnalyticsParams): AnalyticsParams {
  if (!params) return {};
  const clean: AnalyticsParams = {};
  for (const [key, value] of Object.entries(params)) {
    if (PII_KEY.test(key)) continue; // drop anything that smells like PII
    clean[key] = value;
  }
  return clean;
}

/** Strip the query string / hash from a path so no ad-param or token is forwarded. */
function stripQuery(url: string): string {
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  const cut = [q, h].filter((i) => i >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? url : url.slice(0, cut);
}
