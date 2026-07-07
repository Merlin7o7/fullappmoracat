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

/** Where tapping a notification should go, or null if it isn't actionable. */
export function notificationHref(n: NotificationLike): string | null {
  const data = readData(n);
  if (typeof data.slug === "string" && data.slug) return `/community/${data.slug}`;
  if (typeof data.catId === "string" && data.catId) return `/portal/cats`;
  if (typeof data.ticketNumber === "string" && data.ticketNumber) return `/portal/support`;
  if (typeof data.orderNumber === "string" && data.orderNumber) return `/portal/orders`;
  return null;
}
