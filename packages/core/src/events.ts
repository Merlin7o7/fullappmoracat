/**
 * Product events — the first-party measurement spine (MRC-PROD-001 T2).
 *
 * Every event name lives here so the API, the web app and the metrics roll-up
 * cannot drift apart on spelling. Client events are the ONLY names the public
 * `POST /events` endpoint accepts; everything else is written server-side from
 * the services that own the fact (a Cat ID is issued in CatsService, not in a
 * browser). PDPL discipline (R106): props never carry names, phones or emails —
 * `sanitizeEventProps` drops any key that looks like one.
 */

export const CLIENT_EVENTS = [
  "page_landed",
  "register_started",
  "cat_id_ceremony_viewed",
  "card_shared",
  "checkout_started",
  "checkout_provider_selected",
  "claim_page_viewed",
  "public_card_viewed",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export const SERVER_EVENTS = [
  "user_registered",
  "cat_id_issued",
  "cat_updated",
  "health_page_viewed",
  "claim_sent",
  "claim_accepted",
  "cat_merged",
  "clinical_entry_final",
  "vaccination_recorded",
  "reminder_sent",
  "reminder_link_clicked",
  "consent_granted",
  "consent_revoked",
  "membership_activated",
  "renewal_succeeded",
  "renewal_failed",
  "subscription_paused",
  "subscription_skipped",
  "subscription_cancelled",
  "plan_change_requested",
  "certificate_issued",
  "certificate_verified",
  "found_report_submitted",
  "lost_mode_toggled",
  "clinic_summary_viewed",
  "clinic_patient_created",
] as const;
export type ServerEvent = (typeof SERVER_EVENTS)[number];
export type EventName = ClientEvent | ServerEvent;

export function isClientEvent(name: unknown): name is ClientEvent {
  return typeof name === "string" && (CLIENT_EVENTS as readonly string[]).includes(name);
}

/** Keys whose values would be personal data. Dropped from props unconditionally. */
const PII_KEY_RE = /(phone|mobile|email|name|address|token|password|otp|iban|card)/i;
const MAX_PROP_KEYS = 20;
const MAX_PROP_LENGTH = 200;

export type EventProps = Record<string, string | number | boolean | null>;

/**
 * Keep props small and free of personal data. Nested objects are dropped —
 * an event is a fact with a handful of coarse dimensions, not a payload.
 */
export function sanitizeEventProps(input: unknown): EventProps | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: EventProps = {};
  let count = 0;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (count >= MAX_PROP_KEYS) break;
    if (!/^[a-z][a-z0-9_]{0,39}$/i.test(key) || PII_KEY_RE.test(key)) continue;
    if (typeof value === "string") out[key] = value.slice(0, MAX_PROP_LENGTH);
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value;
    else if (typeof value === "boolean" || value === null) out[key] = value;
    else continue;
    count++;
  }
  return count ? out : null;
}

/**
 * First-touch attribution — what a person arrived with the very first time
 * they landed, captured in a first-party cookie and copied onto the account at
 * registration. Only these keys survive; each is clipped so a hand-crafted
 * URL cannot turn the column into a dumping ground.
 */
export const FIRST_TOUCH_KEYS = [
  "src",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "ref",
  "referrerHost",
  "landingPath",
  "at",
] as const;
export type FirstTouchKey = (typeof FIRST_TOUCH_KEYS)[number];
export type FirstTouch = Partial<Record<FirstTouchKey, string>>;

const FIRST_TOUCH_MAX = 120;

export function sanitizeFirstTouch(input: unknown): FirstTouch | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const out: FirstTouch = {};
  for (const key of FIRST_TOUCH_KEYS) {
    const value = (input as Record<string, unknown>)[key];
    if (typeof value !== "string") continue;
    const trimmed = value.trim().slice(0, FIRST_TOUCH_MAX);
    if (trimmed) out[key] = trimmed;
  }
  return Object.keys(out).length ? out : null;
}
