/**
 * Notifications carry a server-built bilingual bundle in `data.i18n` plus a
 * structured payload for deep-linking. These helpers render the member's locale
 * (falling back to the stored English title/body for older rows) and turn a
 * notification into a link to the thing it's about.
 */
export interface NotificationLike {
  title: string;
  body: string;
  data?: unknown;
  category?: string;
}

type LocalizedText = { title: string; body: string };

function readData(n: NotificationLike): Record<string, unknown> {
  return n.data && typeof n.data === "object" ? (n.data as Record<string, unknown>) : {};
}

/** Localized {title, body} for a notification, falling back to stored copy. */
export function notificationText(n: NotificationLike, locale: "ar" | "en"): LocalizedText {
  const i18n = readData(n).i18n as Record<string, LocalizedText> | undefined;
  const localized = i18n?.[locale];
  if (localized?.title && localized?.body) return localized;
  return { title: n.title, body: n.body };
}

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

/**
 * An in-app path from a server-supplied link, or null. Only same-site targets
 * are honoured: a relative path, or an absolute URL on our own host (the API
 * builds some links with the site URL). Anything else is dropped — a
 * notification must never be able to send a member off-site.
 */
export function inAppPath(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw) return null;
  if (raw.startsWith("/")) return raw.startsWith("//") ? null : raw;
  try {
    const url = new URL(raw);
    const ours = new Set([new URL(SITE).host, "moracat.co", "www.moracat.co"]);
    if (typeof window !== "undefined") ours.add(window.location.host);
    if (!ours.has(url.host)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/** Where tapping a notification should go, or null if it isn't actionable. */
export function notificationHref(n: NotificationLike): string | null {
  const data = readData(n);
  // The server knows exactly which screen answers this notification (a finder's
  // message, a clinic's access request…) — its link wins over the generic guesses.
  const explicit = inAppPath(data.link) ?? inAppPath(data.url);
  if (explicit) return explicit;
  if (typeof data.slug === "string" && data.slug) return `/community/${data.slug}`;
  if (typeof data.catId === "string" && data.catId) return `/portal/cats`;
  if (typeof data.ticketNumber === "string" && data.ticketNumber) return `/portal/support`;
  if (typeof data.orderNumber === "string" && data.orderNumber) return `/portal/orders`;
  return null;
}
