import { track } from "@/lib/track";
import type { ClientEvent } from "@moraqat/core";

/**
 * Fire a funnel event at most once per key per page session.
 *
 * React 18 strict mode mounts effects twice in development, and a ceremony or
 * share sheet can re-render many times — a module-level ledger (not a ref,
 * which a remount resets) makes "once" mean once. Keys carry no personal
 * data: they are local only and never sent.
 */
const fired = new Set<string>();

export function trackOnce(event: ClientEvent, key: string, props?: Record<string, string | number | boolean>): void {
  const k = `${event}:${key}`;
  if (fired.has(k)) return;
  fired.add(k);
  track(event, props);
}

/**
 * A card / story / poster was really delivered (shared, saved or exported).
 * Deduped per artefact within a short window so a double-tap or a retried
 * share sheet doesn't count twice, while a genuine second share later does.
 */
const lastShare = new Map<string, number>();

export function trackCardShared(src: string, kind: string, extra?: Record<string, string | number | boolean>): void {
  const k = `${src}:${kind}`;
  const now = Date.now();
  const prev = lastShare.get(k);
  if (prev && now - prev < 3_000) return;
  lastShare.set(k, now);
  track("card_shared", { src, kind, ...extra });
  // "First value" for the referral ask: a member who has shared once has
  // already chosen to tell people (portal home gates the invite card on it).
  try {
    localStorage.setItem(SHARED_KEY, "1");
  } catch {
    /* storage off — the other first-value signals still apply */
  }
}

export const SHARED_KEY = "moraqat.hasShared";

export function hasSharedBefore(): boolean {
  try {
    return localStorage.getItem(SHARED_KEY) === "1";
  } catch {
    return false;
  }
}
