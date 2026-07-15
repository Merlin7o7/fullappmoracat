"use client";

/**
 * Offline survival for the Cat ID (R036 offline card, R114 offline-capable core).
 *
 * The ID's #1 job is safety — "bring my cat home". That truth-moment often
 * happens exactly where there's no signal: a vet counter, a basement clinic, a
 * parking lot. So the primary roster is cached to localStorage whenever it loads
 * online and read back as React Query `initialData`, letting an offline reload
 * render the real card (number, QR, emergency contact) with zero network.
 *
 * The cache is a bonus, never a hard dependency: any storage failure (quota,
 * private mode) degrades silently to the normal online path. Keyed by userId so
 * one member never reads another's cats on a shared device.
 */

import * as React from "react";
import type { PortalCat } from "./cat-context";

const CACHE_VERSION = "v1";
const cacheKey = (userId?: string) => `moraqat.cats.${CACHE_VERSION}.${userId ?? "anon"}`;

/** The last roster we saw online for this member, or undefined if none/unreadable. */
export function readCachedCats(userId?: string): PortalCat[] | undefined {
  if (typeof window === "undefined" || !userId) return undefined;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as PortalCat[]) : undefined;
  } catch {
    return undefined;
  }
}

/** Persist the roster so the Cat ID survives the next dead zone. Fails silently. */
export function writeCachedCats(userId: string | undefined, cats: PortalCat[]): void {
  if (typeof window === "undefined" || !userId || cats.length === 0) return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(cats));
  } catch {
    /* quota exceeded / private mode — the offline card is a bonus, not a promise */
  }
}

/**
 * Sweep every cached roster (all members, all versions). Called on logout so a
 * shared device never leaves one member's cats readable to the next.
 */
export function clearAllCachedCats(): void {
  if (typeof window === "undefined") return;
  try {
    const prefix = "moraqat.cats.";
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) localStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Live online/offline state. SSR-safe: assumes online until mounted so the first
 * paint never flashes an offline banner during hydration.
 */
export function useOnline(): boolean {
  const [online, setOnline] = React.useState(true);
  React.useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
