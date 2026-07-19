"use client";

import * as React from "react";
import { normaliseSourceCode } from "@moraqat/core";

/**
 * Acquisition attribution — the `?src=` code a registration arrived with.
 *
 * The physical stands (MRC-GTM-001 §2) open the census flow from an NFC/QR tile
 * pre-tagged with the stand's own serial: `?src=stand-004`. Per-stand yield is
 * what decides the Year-1 channel strategy ("kill or move any stand under 20
 * IDs/month") and it is **impossible to reconstruct after the fact** — nobody
 * can later remember which counter a member walked past. So it is captured the
 * moment it appears and carried all the way to the cat row.
 *
 * The code can land on either entry point (a stand may point its tile at the
 * home page or straight at /register), and the journey between there and the
 * Cat ID crosses several navigations, so it rides sessionStorage exactly like
 * the pending cat name does — same lifetime, same tab-scoped privacy, cleared
 * by the same consumer.
 */
export const SOURCE_KEY = "moraqat.pendingSource";

/**
 * Read `?src=` off the current URL and remember it.
 *
 * Deliberately NOT `useSearchParams`: that hook forces the page into a Suspense
 * boundary and breaks the static build, which is why the existing `?ref=`
 * capture reads `window.location.search` in an effect instead. Same shape here.
 *
 * First code wins. If someone arrives from stand-004 and later re-enters with
 * a different code in the same session, the stand that actually produced the
 * visit keeps the credit rather than whichever link they clicked last.
 */
export function useCaptureSource(): void {
  React.useEffect(() => {
    try {
      const raw = new URLSearchParams(window.location.search).get("src");
      const code = normaliseSourceCode(raw);
      if (!code) return;
      if (sessionStorage.getItem(SOURCE_KEY)) return;
      sessionStorage.setItem(SOURCE_KEY, code);
    } catch {
      /* Private mode / storage disabled — attribution is nice to have, never
         a reason to break a registration. */
    }
  }, []);
}

/** Read the remembered code (without clearing it). */
export function readSource(): string | undefined {
  try {
    return sessionStorage.getItem(SOURCE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * Read and clear — called once the code has been written to a cat, so a second
 * cat added later in the same session isn't wrongly credited to the stand.
 */
export function consumeSource(): string | undefined {
  const code = readSource();
  try {
    sessionStorage.removeItem(SOURCE_KEY);
  } catch {
    /* ignore */
  }
  return code;
}
